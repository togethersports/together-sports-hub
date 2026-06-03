'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { createClient } = require('@libsql/client');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database (Turso / local libsql) ──────────────────────────────────────────
const db = createClient({
  url:       process.env.TURSO_URL       || 'file:./data/together.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

// Helper wrappers
const all  = (sql, args=[]) => db.execute({ sql, args }).then(r => r.rows);
const get  = (sql, args=[]) => db.execute({ sql, args }).then(r => r.rows[0]);
const run  = (sql, args=[]) => db.execute({ sql, args });

// ── Cloudinary (uploads) ──────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imgFilter = (req, file, cb) => {
  /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
};

// Use disk storage locally (no Cloudinary creds), Cloudinary in production
const makeUpload = () => {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const storage = new CloudinaryStorage({
      cloudinary,
      params: { folder: 'together-sports', allowed_formats: ['jpg','jpeg','png','gif','webp'] },
    });
    return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imgFilter });
  }
  const fs = require('fs');
  const dir = path.join(__dirname, 'data', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  });
  return multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imgFilter });
};
const upload = makeUpload();

// Resolve a stored file reference to a public URL
const fileUrl = (ref) => {
  if (!ref) return null;
  if (ref.startsWith('http')) return ref; // Cloudinary URL
  return `/uploads/${ref}`;               // local
};

// ── Schema + seed ─────────────────────────────────────────────────────────────
async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coaches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      chapter_id INTEGER REFERENCES chapters(id),
      sport_id INTEGER REFERENCES sports(id),
      bio TEXT,
      access_code TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER REFERENCES coaches(id),
      chapter_id INTEGER REFERENCES chapters(id),
      sport_id INTEGER REFERENCES sports(id),
      session_date TEXT NOT NULL,
      duration_minutes INTEGER,
      participants INTEGER,
      location TEXT,
      notes TEXT,
      submitted_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      name TEXT NOT NULL,
      parent_name TEXT,
      parent_contact TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coach_id INTEGER REFERENCES coaches(id),
      coach_name TEXT NOT NULL,
      quote TEXT NOT NULL,
      parent_name TEXT,
      parent_contact TEXT,
      child_name TEXT,
      chapter_id INTEGER REFERENCES chapters(id),
      sport_id INTEGER REFERENCES sports(id),
      photo_filename TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      caption TEXT,
      chapter_id INTEGER REFERENCES chapters(id),
      sport_id INTEGER REFERENCES sports(id),
      session_id INTEGER REFERENCES sessions(id),
      approved INTEGER NOT NULL DEFAULT 1,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const seeded = await get("SELECT value FROM settings WHERE key='seeded'");
  if (!seeded) {
    for (const c of ['NYC','New Jersey','Florida','Ohio','Texas','India'])
      await run('INSERT OR IGNORE INTO chapters (name) VALUES (?)', [c]);
    for (const s of ['Tennis','Basketball','Football','Golf'])
      await run('INSERT OR IGNORE INTO sports (name) VALUES (?)', [s]);

    const ch = async n => (await get('SELECT id FROM chapters WHERE name=?', [n])).id;
    const sp = async n => (await get('SELECT id FROM sports WHERE name=?', [n])).id;

    const nyc = await ch('NYC'); const fl = await ch('Florida'); const oh = await ch('Ohio');
    const nj  = await ch('New Jersey'); const tx = await ch('Texas'); const ind = await ch('India');
    const ten = await sp('Tennis'); const bsk = await sp('Basketball');
    const ftb = await sp('Football'); const glf = await sp('Golf');

    const ic = (name, email, cid, sid) =>
      run('INSERT INTO coaches (name,email,chapter_id,sport_id,active) VALUES (?,?,?,?,1)', [name, email, cid, sid]);

    await ic('Harry Honig',    'harry@togethersports.org',   nyc, ten);
    await ic('Solomon Heyman', 'solomon@togethersports.org', nyc, bsk);
    await ic('Sheldon Heyman', 'sheldon@togethersports.org', nyc, ftb);
    await ic('Jonah Angrist',  'jonah@togethersports.org',   nyc, glf);
    await ic('Ron Slutsky',    'ron@togethersports.org',     fl,  ten);
    await ic('Tiam Zabeti',    'tiam@togethersports.org',    oh,  bsk);
    await run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', nj]);
    await run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', tx]);
    await run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', ind]);

    await run("INSERT INTO settings VALUES ('seeded','1')");
    await run("INSERT OR IGNORE INTO settings VALUES ('org_name','Together Sports')");
    await run("INSERT OR IGNORE INTO settings VALUES ('contact_email','info@togethersports.org')");
    console.log('Database seeded.');
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve local uploads when not using Cloudinary
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  const fs = require('fs');
  const dir = path.join(__dirname, 'data', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  app.use('/uploads', express.static(dir));
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'together-sports';
function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  req.body.password === ADMIN_PASSWORD
    ? res.json({ ok: true })
    : res.status(401).json({ error: 'Wrong password' });
});

app.post('/api/coach-auth', async (req, res) => {
  const { access_code } = req.body;
  if (!access_code) return res.status(400).json({ error: 'Access code required' });
  const coach = await get(
    "SELECT id,name,chapter_id,sport_id FROM coaches WHERE access_code=? AND active=1 AND name!='Coach TBD'",
    [access_code.trim()]
  );
  coach ? res.json({ ok: true, coach }) : res.status(401).json({ error: 'Invalid access code' });
});

// ── Reference data ────────────────────────────────────────────────────────────
app.get('/api/chapters', async (req, res) => res.json(await all('SELECT * FROM chapters ORDER BY name')));
app.get('/api/sports',   async (req, res) => res.json(await all('SELECT * FROM sports ORDER BY name')));

app.post('/api/chapters', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { const r = await run('INSERT INTO chapters (name) VALUES (?)', [name]); res.json({ id: Number(r.lastInsertRowid) }); }
  catch { res.status(409).json({ error: 'Already exists' }); }
});
app.post('/api/sports', requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { const r = await run('INSERT INTO sports (name) VALUES (?)', [name]); res.json({ id: Number(r.lastInsertRowid) }); }
  catch { res.status(409).json({ error: 'Already exists' }); }
});

// ── Coaches ───────────────────────────────────────────────────────────────────
app.get('/api/coaches', async (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const rows = await all(`
    SELECT c.id, c.name, c.email, c.phone, c.chapter_id, c.sport_id, c.bio, c.active,
           ${isAdmin ? 'c.access_code,' : ''}
           ch.name AS chapter, sp.name AS sport
    FROM coaches c
    LEFT JOIN chapters ch ON c.chapter_id=ch.id
    LEFT JOIN sports sp ON c.sport_id=sp.id
    ORDER BY c.name
  `);
  res.json(rows);
});

app.post('/api/coaches', requireAdmin, async (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await run(
    'INSERT INTO coaches (name,email,phone,chapter_id,sport_id,bio) VALUES (?,?,?,?,?,?)',
    [name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null]
  );
  res.json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/coaches/:id', requireAdmin, async (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio, active, access_code } = req.body;
  await run(
    'UPDATE coaches SET name=?,email=?,phone=?,chapter_id=?,sport_id=?,bio=?,active=?,access_code=? WHERE id=?',
    [name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null, active??1, access_code||null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/coaches/:id', requireAdmin, async (req, res) => {
  await run('DELETE FROM coaches WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', requireAdmin, async (req, res) => {
  let sql = `
    SELECT s.*, c.name AS coach, ch.name AS chapter, sp.name AS sport
    FROM sessions s
    LEFT JOIN coaches c ON s.coach_id=c.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    WHERE 1=1
  `;
  const args = [];
  if (req.query.chapter_id) { sql += ' AND s.chapter_id=?'; args.push(req.query.chapter_id); }
  if (req.query.sport_id)   { sql += ' AND s.sport_id=?';   args.push(req.query.sport_id); }
  if (req.query.coach_id)   { sql += ' AND s.coach_id=?';   args.push(req.query.coach_id); }
  if (req.query.date_from)  { sql += ' AND s.session_date>=?'; args.push(req.query.date_from); }
  if (req.query.date_to)    { sql += ' AND s.session_date<=?'; args.push(req.query.date_to); }
  sql += ' ORDER BY s.session_date DESC, s.id DESC';
  res.json(await all(sql, args));
});

app.post('/api/sessions', async (req, res) => {
  const { coach_id, chapter_id, sport_id, session_date, duration_minutes, participants, location, notes, submitted_by } = req.body;
  if (!session_date) return res.status(400).json({ error: 'session_date required' });
  const r = await run(
    'INSERT INTO sessions (coach_id,chapter_id,sport_id,session_date,duration_minutes,participants,location,notes,submitted_by) VALUES (?,?,?,?,?,?,?,?,?)',
    [coach_id||null, chapter_id||null, sport_id||null, session_date, duration_minutes||null, participants||null, location||null, notes||null, submitted_by||null]
  );
  res.json({ id: Number(r.lastInsertRowid) });
});

app.delete('/api/sessions/:id', requireAdmin, async (req, res) => {
  await run('DELETE FROM sessions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Participants ──────────────────────────────────────────────────────────────
app.get('/api/participants', requireAdmin, async (req, res) => {
  let sql = `
    SELECT p.*, s.session_date, s.location, ch.name AS chapter, sp.name AS sport, c.name AS coach
    FROM participants p
    JOIN sessions s ON p.session_id=s.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    LEFT JOIN coaches c ON s.coach_id=c.id
    WHERE 1=1
  `;
  const args = [];
  if (req.query.session_id) { sql += ' AND p.session_id=?'; args.push(req.query.session_id); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(await all(sql, args));
});

app.post('/api/participants', async (req, res) => {
  const { session_id, name, parent_name, parent_contact } = req.body;
  if (!session_id || !name) return res.status(400).json({ error: 'session_id and name required' });
  const r = await run(
    'INSERT INTO participants (session_id,name,parent_name,parent_contact) VALUES (?,?,?,?)',
    [session_id, name, parent_name||null, parent_contact||null]
  );
  res.json({ id: Number(r.lastInsertRowid) });
});

// ── Testimonials ──────────────────────────────────────────────────────────────
app.get('/api/testimonials', requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT t.*, ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    ORDER BY t.created_at DESC
  `);
  res.json(rows.map(r => ({ ...r, photo_url: fileUrl(r.photo_filename) })));
});

app.get('/api/testimonials/public', async (req, res) => {
  const rows = await all(`
    SELECT t.coach_name, t.quote, t.parent_name, t.child_name, t.photo_filename,
           ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    WHERE t.public=1
    ORDER BY t.created_at DESC
  `);
  res.json(rows.map(r => ({ ...r, photo_url: fileUrl(r.photo_filename) })));
});

app.post('/api/testimonials', upload.single('photo'), async (req, res) => {
  const { coach_id, quote, parent_name, parent_contact, child_name, chapter_id, sport_id } = req.body;
  if (!quote) return res.status(400).json({ error: 'quote required' });
  const coachRow = coach_id ? await get('SELECT name FROM coaches WHERE id=?', [coach_id]) : null;
  const coach_name = req.body.coach_name || coachRow?.name || 'Unknown Coach';
  const fileRef = req.file ? (req.file.path || req.file.filename) : null;
  const r = await run(
    'INSERT INTO testimonials (coach_id,coach_name,quote,parent_name,parent_contact,child_name,chapter_id,sport_id,photo_filename) VALUES (?,?,?,?,?,?,?,?,?)',
    [coach_id||null, coach_name, quote, parent_name||null, parent_contact||null, child_name||null, chapter_id||null, sport_id||null, fileRef]
  );
  res.json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/testimonials/:id', requireAdmin, async (req, res) => {
  const { approved, public: pub } = req.body;
  await run('UPDATE testimonials SET approved=?,public=? WHERE id=?', [approved??0, pub??0, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/testimonials/:id', requireAdmin, async (req, res) => {
  const row = await get('SELECT photo_filename FROM testimonials WHERE id=?', [req.params.id]);
  if (row?.photo_filename && process.env.CLOUDINARY_CLOUD_NAME) {
    const pid = row.photo_filename.split('/').pop().split('.')[0];
    await cloudinary.uploader.destroy(`together-sports/${pid}`).catch(() => {});
  }
  await run('DELETE FROM testimonials WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Photos ────────────────────────────────────────────────────────────────────
app.get('/api/photos', requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT p.*, ch.name AS chapter, sp.name AS sport
    FROM photos p
    LEFT JOIN chapters ch ON p.chapter_id=ch.id
    LEFT JOIN sports sp ON p.sport_id=sp.id
    ORDER BY p.uploaded_at DESC
  `);
  res.json(rows.map(r => ({ ...r, url: fileUrl(r.filename) })));
});

app.post('/api/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { caption, chapter_id, sport_id, session_id } = req.body;
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const fileRef = req.file.path || req.file.filename;
  const r = await run(
    'INSERT INTO photos (filename,caption,chapter_id,sport_id,session_id,approved) VALUES (?,?,?,?,?,?)',
    [fileRef, caption||null, chapter_id||null, sport_id||null, session_id||null, isAdmin ? 1 : 0]
  );
  res.json({ id: Number(r.lastInsertRowid), filename: fileRef, url: fileUrl(fileRef) });
});

app.put('/api/photos/:id', requireAdmin, async (req, res) => {
  await run('UPDATE photos SET approved=? WHERE id=?', [req.body.approved??1, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/photos/:id', requireAdmin, async (req, res) => {
  const row = await get('SELECT filename FROM photos WHERE id=?', [req.params.id]);
  if (row) {
    if (process.env.CLOUDINARY_CLOUD_NAME && row.filename) {
      const pid = row.filename.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`together-sports/${pid}`).catch(() => {});
    }
    await run('DELETE FROM photos WHERE id=?', [req.params.id]);
  }
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAdmin, async (req, res) => {
  const [ts, tp, ac, pt, pp, by_chapter, by_sport, recent] = await Promise.all([
    get('SELECT COUNT(*) n FROM sessions'),
    get('SELECT COALESCE(SUM(participants),0) n FROM sessions'),
    get("SELECT COUNT(*) n FROM coaches WHERE active=1 AND name!='Coach TBD'"),
    get('SELECT COUNT(*) n FROM testimonials WHERE approved=0'),
    get('SELECT COUNT(*) n FROM photos WHERE approved=0'),
    all(`SELECT ch.name, COUNT(*) sessions, COALESCE(SUM(s.participants),0) participants
         FROM sessions s JOIN chapters ch ON s.chapter_id=ch.id GROUP BY ch.id ORDER BY sessions DESC`),
    all(`SELECT sp.name, COUNT(*) sessions FROM sessions s JOIN sports sp ON s.sport_id=sp.id GROUP BY sp.id ORDER BY sessions DESC`),
    all(`SELECT s.session_date, c.name coach, ch.name chapter, sp.name sport, s.participants, s.location
         FROM sessions s
         LEFT JOIN coaches c ON s.coach_id=c.id
         LEFT JOIN chapters ch ON s.chapter_id=ch.id
         LEFT JOIN sports sp ON s.sport_id=sp.id
         ORDER BY s.session_date DESC, s.id DESC LIMIT 8`),
  ]);
  res.json({
    total_sessions: Number(ts.n), total_participants: Number(tp.n), active_coaches: Number(ac.n),
    pending_testimonials: Number(pt.n), pending_photos: Number(pp.n),
    by_chapter, by_sport, recent,
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAdmin, async (req, res) => {
  const rows = await all('SELECT key,value FROM settings');
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});
app.post('/api/settings', requireAdmin, async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    if (k !== 'seeded') await run('INSERT OR REPLACE INTO settings VALUES (?,?)', [k, v]);
  }
  res.json({ ok: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Boot ──────────────────────────────────────────────────────────────────────
initDb()
  .then(() => app.listen(PORT, () => console.log(`Together Sports → http://localhost:${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
