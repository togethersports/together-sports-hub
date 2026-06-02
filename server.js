'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'together.db'));
db.pragma('journal_mode = WAL');

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

// ── Seed ──────────────────────────────────────────────────────────────────────
const seeded = db.prepare("SELECT value FROM settings WHERE key='seeded'").get();
if (!seeded) {
  const insertChapter = db.prepare('INSERT OR IGNORE INTO chapters (name) VALUES (?)');
  const insertSport   = db.prepare('INSERT OR IGNORE INTO sports (name) VALUES (?)');
  const insertCoach   = db.prepare('INSERT INTO coaches (name,email,chapter_id,sport_id,active) VALUES (?,?,?,?,1)');

  ['NYC','New Jersey','Florida','Ohio','Texas','India'].forEach(c => insertChapter.run(c));
  ['Tennis','Basketball','Football','Golf'].forEach(s => insertSport.run(s));

  const ch = n => db.prepare('SELECT id FROM chapters WHERE name=?').get(n).id;
  const sp = n => db.prepare('SELECT id FROM sports WHERE name=?').get(n).id;

  insertCoach.run('Harry Honig',    'harry@togethersports.org',   ch('NYC'),     sp('Tennis'));
  insertCoach.run('Solomon Heyman', 'solomon@togethersports.org', ch('NYC'),     sp('Basketball'));
  insertCoach.run('Sheldon Heyman', 'sheldon@togethersports.org', ch('NYC'),     sp('Football'));
  insertCoach.run('Jonah Angrist',  'jonah@togethersports.org',   ch('NYC'),     sp('Golf'));
  insertCoach.run('Ron Slutsky',    'ron@togethersports.org',     ch('Florida'), sp('Tennis'));
  insertCoach.run('Tiam Zabeti',    'tiam@togethersports.org',    ch('Ohio'),    sp('Basketball'));
  insertCoach.run('Coach TBD',      null, ch('New Jersey'), null);
  insertCoach.run('Coach TBD',      null, ch('Texas'),      null);
  insertCoach.run('Coach TBD',      null, ch('India'),      null);

  db.prepare("INSERT INTO settings VALUES ('seeded','1')").run();
  db.prepare("INSERT OR IGNORE INTO settings VALUES ('org_name','Together Sports')").run();
  db.prepare("INSERT OR IGNORE INTO settings VALUES ('contact_email','info@togethersports.org')").run();
  console.log('Database seeded.');
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const ADMIN_PASSWORD = 'together-sports';
function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const imgFilter = (req, file, cb) => {
  /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
};
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `img_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imgFilter });

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  req.body.password === ADMIN_PASSWORD
    ? res.json({ ok: true })
    : res.status(401).json({ error: 'Wrong password' });
});

// ── Reference data ────────────────────────────────────────────────────────────
app.get('/api/chapters', (req, res) => res.json(db.prepare('SELECT * FROM chapters ORDER BY name').all()));
app.get('/api/sports',   (req, res) => res.json(db.prepare('SELECT * FROM sports ORDER BY name').all()));

app.post('/api/chapters', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { res.json({ id: db.prepare('INSERT INTO chapters (name) VALUES (?)').run(name).lastInsertRowid }); }
  catch(e) { res.status(409).json({ error: 'Already exists' }); }
});
app.post('/api/sports', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try { res.json({ id: db.prepare('INSERT INTO sports (name) VALUES (?)').run(name).lastInsertRowid }); }
  catch(e) { res.status(409).json({ error: 'Already exists' }); }
});

// ── Coaches ───────────────────────────────────────────────────────────────────
app.get('/api/coaches', (req, res) => {
  res.json(db.prepare(`
    SELECT c.*, ch.name AS chapter, sp.name AS sport
    FROM coaches c
    LEFT JOIN chapters ch ON c.chapter_id=ch.id
    LEFT JOIN sports sp ON c.sport_id=sp.id
    ORDER BY c.name
  `).all());
});

app.post('/api/coaches', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO coaches (name,email,phone,chapter_id,sport_id,bio) VALUES (?,?,?,?,?,?)')
    .run(name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/coaches/:id', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio, active } = req.body;
  db.prepare('UPDATE coaches SET name=?,email=?,phone=?,chapter_id=?,sport_id=?,bio=?,active=? WHERE id=?')
    .run(name, email||null, phone||null, chapter_id||null, sport_id||null, bio||null, active??1, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/coaches/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coaches WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', requireAdmin, (req, res) => {
  let sql = `
    SELECT s.*, c.name AS coach, ch.name AS chapter, sp.name AS sport
    FROM sessions s
    LEFT JOIN coaches c ON s.coach_id=c.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    WHERE 1=1
  `;
  const params = [];
  if (req.query.chapter_id) { sql += ' AND s.chapter_id=?'; params.push(req.query.chapter_id); }
  if (req.query.sport_id)   { sql += ' AND s.sport_id=?';   params.push(req.query.sport_id); }
  if (req.query.coach_id)   { sql += ' AND s.coach_id=?';   params.push(req.query.coach_id); }
  if (req.query.date_from)  { sql += ' AND s.session_date>=?'; params.push(req.query.date_from); }
  if (req.query.date_to)    { sql += ' AND s.session_date<=?'; params.push(req.query.date_to); }
  sql += ' ORDER BY s.session_date DESC, s.id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/sessions', (req, res) => {
  const { coach_id, chapter_id, sport_id, session_date, duration_minutes,
          participants, location, notes, submitted_by } = req.body;
  if (!session_date) return res.status(400).json({ error: 'session_date required' });
  const r = db.prepare(`
    INSERT INTO sessions (coach_id,chapter_id,sport_id,session_date,duration_minutes,participants,location,notes,submitted_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(coach_id||null, chapter_id||null, sport_id||null, session_date,
         duration_minutes||null, participants||null, location||null, notes||null, submitted_by||null);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/sessions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Participants ──────────────────────────────────────────────────────────────
app.get('/api/participants', requireAdmin, (req, res) => {
  let sql = `
    SELECT p.*, s.session_date, s.location, ch.name AS chapter, sp.name AS sport, c.name AS coach
    FROM participants p
    JOIN sessions s ON p.session_id=s.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    LEFT JOIN coaches c ON s.coach_id=c.id
    WHERE 1=1
  `;
  const params = [];
  if (req.query.session_id) { sql += ' AND p.session_id=?'; params.push(req.query.session_id); }
  sql += ' ORDER BY p.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/participants', (req, res) => {
  const { session_id, name, parent_name, parent_contact } = req.body;
  if (!session_id || !name) return res.status(400).json({ error: 'session_id and name required' });
  const r = db.prepare('INSERT INTO participants (session_id,name,parent_name,parent_contact) VALUES (?,?,?,?)')
    .run(session_id, name, parent_name||null, parent_contact||null);
  res.json({ id: r.lastInsertRowid });
});

// ── Testimonials ──────────────────────────────────────────────────────────────
app.get('/api/testimonials', requireAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT t.*, ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    ORDER BY t.created_at DESC
  `).all());
});

app.get('/api/testimonials/public', (req, res) => {
  res.json(db.prepare(`
    SELECT t.coach_name, t.quote, t.parent_name, t.child_name, t.photo_filename,
           ch.name AS chapter, sp.name AS sport
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    WHERE t.public=1
    ORDER BY t.created_at DESC
  `).all());
});

app.post('/api/testimonials', upload.single('photo'), (req, res) => {
  const { coach_id, quote, parent_name, parent_contact, child_name, chapter_id, sport_id } = req.body;
  if (!quote) return res.status(400).json({ error: 'quote required' });
  const coachRow = coach_id ? db.prepare('SELECT name FROM coaches WHERE id=?').get(coach_id) : null;
  const coach_name = req.body.coach_name || coachRow?.name || 'Unknown Coach';
  const r = db.prepare(`
    INSERT INTO testimonials (coach_id,coach_name,quote,parent_name,parent_contact,child_name,chapter_id,sport_id,photo_filename)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(coach_id||null, coach_name, quote, parent_name||null, parent_contact||null, child_name||null,
         chapter_id||null, sport_id||null, req.file?.filename||null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/testimonials/:id', requireAdmin, (req, res) => {
  const { approved, public: pub } = req.body;
  db.prepare('UPDATE testimonials SET approved=?,public=? WHERE id=?')
    .run(approved??0, pub??0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/testimonials/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT photo_filename FROM testimonials WHERE id=?').get(req.params.id);
  if (row?.photo_filename) {
    const fp = path.join(UPLOADS_DIR, row.photo_filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM testimonials WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Photos ────────────────────────────────────────────────────────────────────
app.get('/api/photos', requireAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, ch.name AS chapter, sp.name AS sport
    FROM photos p
    LEFT JOIN chapters ch ON p.chapter_id=ch.id
    LEFT JOIN sports sp ON p.sport_id=sp.id
    ORDER BY p.uploaded_at DESC
  `).all());
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const { caption, chapter_id, sport_id, session_id } = req.body;
  const isAdmin = (req.headers['x-admin-token'] || req.query.token) === ADMIN_PASSWORD;
  const r = db.prepare('INSERT INTO photos (filename,caption,chapter_id,sport_id,session_id,approved) VALUES (?,?,?,?,?,?)')
    .run(req.file.filename, caption||null, chapter_id||null, sport_id||null, session_id||null, isAdmin ? 1 : 0);
  res.json({ id: r.lastInsertRowid, filename: req.file.filename });
});

app.put('/api/photos/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE photos SET approved=? WHERE id=?').run(req.body.approved??1, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/photos/:id', requireAdmin, (req, res) => {
  const row = db.prepare('SELECT filename FROM photos WHERE id=?').get(req.params.id);
  if (row) {
    const fp = path.join(UPLOADS_DIR, row.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    db.prepare('DELETE FROM photos WHERE id=?').run(req.params.id);
  }
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAdmin, (req, res) => {
  const total_sessions     = db.prepare('SELECT COUNT(*) n FROM sessions').get().n;
  const total_participants = db.prepare('SELECT COALESCE(SUM(participants),0) n FROM sessions').get().n;
  const active_coaches     = db.prepare("SELECT COUNT(*) n FROM coaches WHERE active=1 AND name!='Coach TBD'").get().n;
  const pending_testimonials = db.prepare('SELECT COUNT(*) n FROM testimonials WHERE approved=0').get().n;
  const pending_photos     = db.prepare('SELECT COUNT(*) n FROM photos WHERE approved=0').get().n;

  const by_chapter = db.prepare(`
    SELECT ch.name, COUNT(*) sessions, COALESCE(SUM(s.participants),0) participants
    FROM sessions s JOIN chapters ch ON s.chapter_id=ch.id
    GROUP BY ch.id ORDER BY sessions DESC
  `).all();

  const by_sport = db.prepare(`
    SELECT sp.name, COUNT(*) sessions
    FROM sessions s JOIN sports sp ON s.sport_id=sp.id
    GROUP BY sp.id ORDER BY sessions DESC
  `).all();

  const recent = db.prepare(`
    SELECT s.session_date, c.name coach, ch.name chapter, sp.name sport, s.participants, s.location
    FROM sessions s
    LEFT JOIN coaches c ON s.coach_id=c.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    ORDER BY s.session_date DESC, s.id DESC LIMIT 8
  `).all();

  res.json({ total_sessions, total_participants, active_coaches,
             pending_testimonials, pending_photos, by_chapter, by_sport, recent });
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});
app.post('/api/settings', requireAdmin, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)');
  Object.entries(req.body).forEach(([k,v]) => { if (k !== 'seeded') upsert.run(k, v); });
  res.json({ ok: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.listen(PORT, () => console.log(`Together Sports → http://localhost:${PORT}`));
