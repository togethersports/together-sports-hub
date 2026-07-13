'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────────
const DATA_DIR    = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(DATA_DIR))    fs.mkdirSync(DATA_DIR,    { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'together.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const all = (sql, args=[]) => db.prepare(sql).all(...args);
const get = (sql, args=[]) => db.prepare(sql).get(...args);
const run = (sql, args=[]) => db.prepare(sql).run(...args);

// ── Schema + seed ─────────────────────────────────────────────────────────────
db.exec(`
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
    volunteer_log_id INTEGER REFERENCES volunteer_logs(id),
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
  CREATE TABLE IF NOT EXISTS volunteer_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_id INTEGER REFERENCES coaches(id),
    log_date TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    people_helped INTEGER DEFAULT 0,
    hours REAL DEFAULT 0,
    chapter_id INTEGER REFERENCES chapters(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migrate existing DBs — each guarded individually so an old copy of
// data/together.db (gitignored, so it survives checkouts/pulls untouched)
// picks up columns added after it was first created.
const migrations = [
  'ALTER TABLE participants ADD COLUMN volunteer_log_id INTEGER REFERENCES volunteer_logs(id)',
  'ALTER TABLE coaches ADD COLUMN access_code TEXT',
  'ALTER TABLE testimonials ADD COLUMN approved INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE testimonials ADD COLUMN public INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE photos ADD COLUMN approved INTEGER NOT NULL DEFAULT 1',
];
for (const sql of migrations) { try { run(sql); } catch {} }

const seeded = get("SELECT value FROM settings WHERE key='seeded'");
if (!seeded) {
  for (const c of ['NYC','New Jersey','Florida','Ohio','Texas','India'])
    run('INSERT OR IGNORE INTO chapters (name) VALUES (?)', [c]);
  for (const s of ['Tennis','Basketball','Football','Golf'])
    run('INSERT OR IGNORE INTO sports (name) VALUES (?)', [s]);

  const ch = n => get('SELECT id FROM chapters WHERE name=?', [n]).id;
  const sp = n => get('SELECT id FROM sports WHERE name=?', [n]).id;

  const nyc = ch('NYC'), fl = ch('Florida'), oh = ch('Ohio');
  const nj  = ch('New Jersey'), tx = ch('Texas'), ind = ch('India');
  const ten = sp('Tennis'), bsk = sp('Basketball'), ftb = sp('Football'), glf = sp('Golf');

  const ic = (name, email, cid, sid) =>
    run('INSERT INTO coaches (name,email,chapter_id,sport_id,active) VALUES (?,?,?,?,1)', [name, email, cid, sid]);

  ic('Harry Honig',    'harry@togethersports.org',   nyc, ten);
  ic('Solomon Heyman', 'solomon@togethersports.org', nyc, bsk);
  ic('Sheldon Heyman', 'sheldon@togethersports.org', nyc, ftb);
  ic('Jonah Angrist',  'jonah@togethersports.org',   nyc, glf);
  ic('Ron Slutsky',    'ron@togethersports.org',     fl,  ten);
  ic('Tiam Zabeti',    'tiam@togethersports.org',    oh,  bsk);
  run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', nj]);
  run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', tx]);
  run('INSERT INTO coaches (name,chapter_id,active) VALUES (?,?,1)', ['Coach TBD', ind]);

  run("INSERT INTO settings VALUES ('seeded','1')");
  run("INSERT OR IGNORE INTO settings VALUES ('org_name','Together Sports')");
  run("INSERT OR IGNORE INTO settings VALUES ('contact_email','info@togethersports.org')");
  console.log('Database seeded.');
}

// ── Uploads ───────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only')),
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

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

app.post('/api/coach-auth', (req, res) => {
  const { access_code } = req.body;
  if (!access_code) return res.status(400).json({ error: 'Access code required' });
  const coach = get(
    "SELECT id,name,chapter_id,sport_id FROM coaches WHERE access_code=? AND active=1 AND name!='Coach TBD'",
    [access_code.trim()]
  );
  coach ? res.json({ ok: true, coach }) : res.status(401).json({ error: 'Invalid access code' });
});

// ── Reference data ────────────────────────────────────────────────────────────
app.get('/api/chapters', (req, res) => res.json(all('SELECT * FROM chapters ORDER BY name')));
app.get('/api/sports',   (req, res) => res.json(all('SELECT * FROM sports ORDER BY name')));

app.post('/api/chapters', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { const r = run('INSERT INTO chapters (name) VALUES (?)', [name]); res.json({ id: r.lastInsertRowid }); }
  catch { res.status(409).json({ error: 'Already exists' }); }
});
app.post('/api/sports', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { const r = run('INSERT INTO sports (name) VALUES (?)', [name]); res.json({ id: r.lastInsertRowid }); }
  catch { res.status(409).json({ error: 'Already exists' }); }
});

// ── Coaches ───────────────────────────────────────────────────────────────────
app.get('/api/coaches', (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  res.json(db.prepare(`
    SELECT c.id, c.name, c.email, c.phone, c.chapter_id, c.sport_id, c.bio, c.active,
           ${isAdmin ? 'c.access_code,' : ''}
           ch.name AS chapter, sp.name AS sport
    FROM coaches c
    LEFT JOIN chapters ch ON c.chapter_id=ch.id
    LEFT JOIN sports sp ON c.sport_id=sp.id
    ORDER BY c.name
  `).all());
});

app.post('/api/coaches', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = run('INSERT INTO coaches (name,email,phone,chapter_id,sport_id,bio) VALUES (?,?,?,?,?,?)',
    [name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null]);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/coaches/:id', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio, active, access_code } = req.body;
  run('UPDATE coaches SET name=?,email=?,phone=?,chapter_id=?,sport_id=?,bio=?,active=?,access_code=? WHERE id=?',
    [name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null, active??1, access_code||null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/coaches/:id', requireAdmin, (req, res) => {
  run('DELETE FROM coaches WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  // Coaches can only fetch their own sessions; admin can fetch all
  if (!isAdmin && !req.query.coach_id) return res.status(401).json({ error: 'Unauthorized' });
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
  res.json(all(sql, args));
});

app.post('/api/sessions', (req, res) => {
  const { coach_id, chapter_id, sport_id, session_date, duration_minutes, participants, location, notes, submitted_by } = req.body;
  if (!session_date) return res.status(400).json({ error: 'session_date required' });
  const r = run(
    'INSERT INTO sessions (coach_id,chapter_id,sport_id,session_date,duration_minutes,participants,location,notes,submitted_by) VALUES (?,?,?,?,?,?,?,?,?)',
    [coach_id||null, chapter_id||null, sport_id||null, session_date, duration_minutes||null, participants||null, location||null, notes||null, submitted_by||null]
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/sessions/:id', (req, res) => {
  const { coach_id, chapter_id, sport_id, session_date, duration_minutes, participants, location, notes } = req.body;
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const existing = get('SELECT coach_id FROM sessions WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && String(existing.coach_id) !== String(coach_id)) return res.status(403).json({ error: 'Forbidden' });
  run(
    'UPDATE sessions SET chapter_id=?,sport_id=?,session_date=?,duration_minutes=?,participants=?,location=?,notes=? WHERE id=?',
    [chapter_id||null, sport_id||null, session_date, duration_minutes||null, participants||null, location||null, notes||null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/sessions/:id', (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const { coach_id } = req.body || {};
  const existing = get('SELECT coach_id FROM sessions WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && String(existing.coach_id) !== String(coach_id)) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM sessions WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Participants ──────────────────────────────────────────────────────────────
app.get('/api/participants', requireAdmin, (req, res) => {
  const args = [];
  let sql;
  if (req.query.volunteer_log_id) {
    sql = 'SELECT p.* FROM participants p WHERE p.volunteer_log_id=? ORDER BY p.created_at DESC';
    args.push(req.query.volunteer_log_id);
  } else {
    sql = `
      SELECT p.*, s.session_date, s.location, ch.name AS chapter, sp.name AS sport, c.name AS coach
      FROM participants p
      LEFT JOIN sessions s ON p.session_id=s.id
      LEFT JOIN chapters ch ON s.chapter_id=ch.id
      LEFT JOIN sports sp ON s.sport_id=sp.id
      LEFT JOIN coaches c ON s.coach_id=c.id
      WHERE 1=1
    `;
    if (req.query.session_id) { sql += ' AND p.session_id=?'; args.push(req.query.session_id); }
    sql += ' ORDER BY p.created_at DESC';
  }
  res.json(all(sql, args));
});

app.post('/api/participants', (req, res) => {
  const { session_id, volunteer_log_id, name, parent_name, parent_contact } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!session_id && !volunteer_log_id) return res.status(400).json({ error: 'session_id or volunteer_log_id required' });
  const r = run(
    'INSERT INTO participants (session_id,volunteer_log_id,name,parent_name,parent_contact) VALUES (?,?,?,?,?)',
    [session_id||null, volunteer_log_id||null, name, parent_name||null, parent_contact||null]
  );
  res.json({ id: r.lastInsertRowid });
});

// ── Testimonials ──────────────────────────────────────────────────────────────
app.get('/api/testimonials', requireAdmin, (req, res) => {
  const rows = all(`
    SELECT t.*, ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    ORDER BY t.created_at DESC
  `);
  res.json(rows.map(r => ({ ...r, photo_url: r.photo_filename ? `/uploads/${r.photo_filename}` : null })));
});

// Public stats for impact page (no auth required)
app.get('/api/impact-stats', (req, res) => {
  res.json({
    total_sessions:      get('SELECT COUNT(*) n FROM sessions').n,
    total_participants:  get('SELECT COALESCE(SUM(participants),0) n FROM sessions').n,
    total_people_helped: get('SELECT COALESCE(SUM(people_helped),0) n FROM volunteer_logs').n,
    active_coaches:      get("SELECT COUNT(*) n FROM coaches WHERE active=1 AND name!='Coach TBD'").n,
    chapters_active:     get("SELECT COUNT(DISTINCT chapter_id) n FROM sessions WHERE chapter_id IS NOT NULL").n,
    by_chapter: all(`SELECT ch.name, COUNT(*) sessions, COALESCE(SUM(s.participants),0) participants
                     FROM sessions s JOIN chapters ch ON s.chapter_id=ch.id GROUP BY ch.id ORDER BY sessions DESC`),
  });
});

app.get('/api/testimonials/public', (req, res) => {
  const rows = all(`
    SELECT t.coach_name, t.quote, t.parent_name, t.child_name, t.photo_filename,
           ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    WHERE t.public=1
    ORDER BY t.created_at DESC
  `);
  res.json(rows.map(r => ({ ...r, photo_url: r.photo_filename ? `/uploads/${r.photo_filename}` : null })));
});

app.post('/api/testimonials', upload.single('photo'), (req, res) => {
  const { coach_id, quote, parent_name, parent_contact, child_name, chapter_id, sport_id } = req.body;
  if (!quote) return res.status(400).json({ error: 'quote required' });
  const coachRow = coach_id ? get('SELECT name FROM coaches WHERE id=?', [coach_id]) : null;
  const coach_name = req.body.coach_name || coachRow?.name || 'Unknown Coach';
  const r = run(
    'INSERT INTO testimonials (coach_id,coach_name,quote,parent_name,parent_contact,child_name,chapter_id,sport_id,photo_filename) VALUES (?,?,?,?,?,?,?,?,?)',
    [coach_id||null, coach_name, quote, parent_name||null, parent_contact||null, child_name||null, chapter_id||null, sport_id||null, req.file?.filename||null]
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/testimonials/:id', requireAdmin, (req, res) => {
  const { approved, public: pub } = req.body;
  run('UPDATE testimonials SET approved=?,public=? WHERE id=?', [approved??0, pub??0, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/testimonials/:id', requireAdmin, (req, res) => {
  const row = get('SELECT photo_filename FROM testimonials WHERE id=?', [req.params.id]);
  if (row?.photo_filename) {
    const fp = path.join(UPLOADS_DIR, row.photo_filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  run('DELETE FROM testimonials WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Photos ────────────────────────────────────────────────────────────────────
app.get('/api/photos/public', (req, res) => {
  const rows = all(`
    SELECT p.filename, p.caption, ch.name AS chapter, sp.name AS sport
    FROM photos p
    LEFT JOIN chapters ch ON p.chapter_id=ch.id
    LEFT JOIN sports sp ON p.sport_id=sp.id
    WHERE p.approved=1
    ORDER BY p.uploaded_at DESC
    LIMIT 60
  `);
  res.json(rows.map(r => ({ ...r, url: `/uploads/${r.filename}` })));
});

app.get('/api/photos', requireAdmin, (req, res) => {
  const rows = all(`
    SELECT p.*, ch.name AS chapter, sp.name AS sport
    FROM photos p
    LEFT JOIN chapters ch ON p.chapter_id=ch.id
    LEFT JOIN sports sp ON p.sport_id=sp.id
    ORDER BY p.uploaded_at DESC
  `);
  res.json(rows.map(r => ({ ...r, url: `/uploads/${r.filename}` })));
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { caption, chapter_id, sport_id, session_id } = req.body;
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const r = run(
    'INSERT INTO photos (filename,caption,chapter_id,sport_id,session_id,approved) VALUES (?,?,?,?,?,?)',
    [req.file.filename, caption||null, chapter_id||null, sport_id||null, session_id||null, isAdmin ? 1 : 0]
  );
  res.json({ id: r.lastInsertRowid, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

app.put('/api/photos/:id', requireAdmin, (req, res) => {
  run('UPDATE photos SET approved=? WHERE id=?', [req.body.approved??1, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/photos/:id', requireAdmin, (req, res) => {
  const row = get('SELECT filename FROM photos WHERE id=?', [req.params.id]);
  if (row) {
    const fp = path.join(UPLOADS_DIR, row.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    run('DELETE FROM photos WHERE id=?', [req.params.id]);
  }
  res.json({ ok: true });
});

// ── Volunteer Logs ────────────────────────────────────────────────────────────
app.get('/api/volunteer-logs', (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  let sql = `
    SELECT v.*, c.name AS coach, ch.name AS chapter
    FROM volunteer_logs v
    LEFT JOIN coaches c ON v.coach_id=c.id
    LEFT JOIN chapters ch ON v.chapter_id=ch.id
    WHERE 1=1
  `;
  const args = [];
  if (!isAdmin && req.query.coach_id) { sql += ' AND v.coach_id=?'; args.push(req.query.coach_id); }
  else if (req.query.coach_id) { sql += ' AND v.coach_id=?'; args.push(req.query.coach_id); }
  sql += ' ORDER BY v.log_date DESC, v.id DESC';
  res.json(all(sql, args));
});

app.post('/api/volunteer-logs', (req, res) => {
  const { coach_id, log_date, activity_type, description, people_helped, hours, chapter_id } = req.body;
  if (!log_date || !activity_type) return res.status(400).json({ error: 'log_date and activity_type required' });
  const r = run(
    'INSERT INTO volunteer_logs (coach_id,log_date,activity_type,description,people_helped,hours,chapter_id) VALUES (?,?,?,?,?,?,?)',
    [coach_id||null, log_date, activity_type, description||null, people_helped||0, hours||0, chapter_id||null]
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/volunteer-logs/:id', (req, res) => {
  const { coach_id, log_date, activity_type, description, people_helped, hours, chapter_id } = req.body;
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const existing = get('SELECT coach_id FROM volunteer_logs WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && String(existing.coach_id) !== String(coach_id)) return res.status(403).json({ error: 'Forbidden' });
  run(
    'UPDATE volunteer_logs SET log_date=?,activity_type=?,description=?,people_helped=?,hours=?,chapter_id=? WHERE id=?',
    [log_date, activity_type, description||null, people_helped||0, hours||0, chapter_id||null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/volunteer-logs/:id', (req, res) => {
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const { coach_id } = req.body || {};
  const existing = get('SELECT coach_id FROM volunteer_logs WHERE id=?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (!isAdmin && String(existing.coach_id) !== String(coach_id)) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM volunteer_logs WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAdmin, (req, res) => {
  res.json({
    total_sessions:      get('SELECT COUNT(*) n FROM sessions').n,
    total_participants:  get('SELECT COALESCE(SUM(participants),0) n FROM sessions').n,
    active_coaches:      get("SELECT COUNT(*) n FROM coaches WHERE active=1 AND name!='Coach TBD'").n,
    pending_testimonials:get('SELECT COUNT(*) n FROM testimonials WHERE approved=0').n,
    pending_photos:      get('SELECT COUNT(*) n FROM photos WHERE approved=0').n,
    by_chapter: all(`SELECT ch.name, COUNT(*) sessions, COALESCE(SUM(s.participants),0) participants
                     FROM sessions s JOIN chapters ch ON s.chapter_id=ch.id GROUP BY ch.id ORDER BY sessions DESC`),
    by_sport:   all(`SELECT sp.name, COUNT(*) sessions FROM sessions s JOIN sports sp ON s.sport_id=sp.id GROUP BY sp.id ORDER BY sessions DESC`),
    recent:     all(`SELECT s.session_date, c.name coach, ch.name chapter, sp.name sport, s.participants, s.location
                     FROM sessions s
                     LEFT JOIN coaches c ON s.coach_id=c.id
                     LEFT JOIN chapters ch ON s.chapter_id=ch.id
                     LEFT JOIN sports sp ON s.sport_id=sp.id
                     ORDER BY s.session_date DESC, s.id DESC LIMIT 8`),
  });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAdmin, (req, res) => {
  res.json(Object.fromEntries(all('SELECT key,value FROM settings').map(r => [r.key, r.value])));
});
app.post('/api/settings', requireAdmin, (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    if (k !== 'seeded') run('INSERT OR REPLACE INTO settings VALUES (?,?)', [k, v]);
  }
  res.json({ ok: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => console.log(`Together Sports → http://localhost:${PORT}`));
