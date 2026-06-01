'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'together.db'));
db.pragma('journal_mode = WAL');

// ── Schema ──────────────────────────────────────────────────────────────────
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

  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    caption TEXT,
    chapter_id INTEGER REFERENCES chapters(id),
    sport_id INTEGER REFERENCES sports(id),
    session_id INTEGER REFERENCES sessions(id),
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── Seed ─────────────────────────────────────────────────────────────────────
const seeded = db.prepare("SELECT value FROM settings WHERE key='seeded'").get();
if (!seeded) {
  const insertChapter = db.prepare('INSERT OR IGNORE INTO chapters (name) VALUES (?)');
  const insertSport   = db.prepare('INSERT OR IGNORE INTO sports (name) VALUES (?)');
  const insertCoach   = db.prepare(`
    INSERT INTO coaches (name, email, chapter_id, sport_id, active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const chapters = ['NYC', 'New Jersey', 'Florida', 'Ohio', 'Texas', 'India'];
  const sports   = ['Tennis', 'Basketball', 'Football', 'Golf'];

  chapters.forEach(c => insertChapter.run(c));
  sports.forEach(s => insertSport.run(s));

  const ch = name => db.prepare('SELECT id FROM chapters WHERE name=?').get(name).id;
  const sp = name => db.prepare('SELECT id FROM sports WHERE name=?').get(name).id;

  // NYC coaches
  insertCoach.run('Harry Honig',     'harry@togethersports.org',   ch('NYC'),        sp('Tennis'));
  insertCoach.run('Solomon Heyman',  'solomon@togethersports.org', ch('NYC'),        sp('Basketball'));
  insertCoach.run('Sheldon Heyman',  'sheldon@togethersports.org', ch('NYC'),        sp('Football'));
  insertCoach.run('Jonah Angrist',   'jonah@togethersports.org',   ch('NYC'),        sp('Golf'));
  // Florida
  insertCoach.run('Ron Slutsky',     'ron@togethersports.org',     ch('Florida'),    sp('Tennis'));
  // Ohio
  insertCoach.run('Tiam Zabeti',     'tiam@togethersports.org',    ch('Ohio'),       sp('Basketball'));
  // Placeholders
  insertCoach.run('Coach TBD',       null,                          ch('New Jersey'), null);
  insertCoach.run('Coach TBD',       null,                          ch('Texas'),      null);
  insertCoach.run('Coach TBD',       null,                          ch('India'),      null);

  db.prepare("INSERT INTO settings (key,value) VALUES ('seeded','1')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('org_name','Together Sports')").run();
  db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('contact_email','info@togethersports.org')").run();
  console.log('Database seeded.');
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple session auth via header/query param
const ADMIN_PASSWORD = 'together-sports';
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) res.json({ ok: true });
  else res.status(401).json({ error: 'Wrong password' });
});

// ── Chapters ──────────────────────────────────────────────────────────────────
app.get('/api/chapters', (req, res) => {
  res.json(db.prepare('SELECT * FROM chapters ORDER BY name').all());
});

// ── Sports ────────────────────────────────────────────────────────────────────
app.get('/api/sports', (req, res) => {
  res.json(db.prepare('SELECT * FROM sports ORDER BY name').all());
});

// ── Chapters (write) ─────────────────────────────────────────────────────────
app.post('/api/chapters', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const r = db.prepare('INSERT INTO chapters (name) VALUES (?)').run(name);
    res.json({ id: r.lastInsertRowid });
  } catch(e) { res.status(409).json({ error: 'Already exists' }); }
});

// ── Sports (write) ────────────────────────────────────────────────────────────
app.post('/api/sports', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const r = db.prepare('INSERT INTO sports (name) VALUES (?)').run(name);
    res.json({ id: r.lastInsertRowid });
  } catch(e) { res.status(409).json({ error: 'Already exists' }); }
});

// ── Coaches ───────────────────────────────────────────────────────────────────
app.get('/api/coaches', (req, res) => {
  const rows = db.prepare(`
    SELECT coaches.*, chapters.name AS chapter, sports.name AS sport
    FROM coaches
    LEFT JOIN chapters ON coaches.chapter_id = chapters.id
    LEFT JOIN sports   ON coaches.sport_id   = sports.id
    ORDER BY coaches.name
  `).all();
  res.json(rows);
});

app.post('/api/coaches', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`
    INSERT INTO coaches (name,email,phone,chapter_id,sport_id,bio)
    VALUES (?,?,?,?,?,?)
  `).run(name, email || null, phone || null, chapter_id || null, sport_id || null, bio || null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/coaches/:id', requireAdmin, (req, res) => {
  const { name, email, phone, chapter_id, sport_id, bio, active } = req.body;
  db.prepare(`
    UPDATE coaches SET name=?,email=?,phone=?,chapter_id=?,sport_id=?,bio=?,active=?
    WHERE id=?
  `).run(name, email || null, phone || null, chapter_id || null, sport_id || null, bio || null,
         active === undefined ? 1 : active, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/coaches/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coaches WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Sessions ──────────────────────────────────────────────────────────────────
app.get('/api/sessions', requireAdmin, (req, res) => {
  let sql = `
    SELECT sessions.*,
      coaches.name   AS coach,
      chapters.name  AS chapter,
      sports.name    AS sport
    FROM sessions
    LEFT JOIN coaches  ON sessions.coach_id   = coaches.id
    LEFT JOIN chapters ON sessions.chapter_id = chapters.id
    LEFT JOIN sports   ON sessions.sport_id   = sports.id
    WHERE 1=1
  `;
  const params = [];
  if (req.query.chapter_id) { sql += ' AND sessions.chapter_id=?'; params.push(req.query.chapter_id); }
  if (req.query.sport_id)   { sql += ' AND sessions.sport_id=?';   params.push(req.query.sport_id); }
  if (req.query.coach_id)   { sql += ' AND sessions.coach_id=?';   params.push(req.query.coach_id); }
  if (req.query.date_from)  { sql += ' AND sessions.session_date>=?'; params.push(req.query.date_from); }
  if (req.query.date_to)    { sql += ' AND sessions.session_date<=?'; params.push(req.query.date_to); }
  sql += ' ORDER BY sessions.session_date DESC, sessions.id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/sessions', (req, res) => {
  const { coach_id, chapter_id, sport_id, session_date, duration_minutes,
          participants, location, notes, submitted_by } = req.body;
  if (!session_date) return res.status(400).json({ error: 'session_date required' });
  const r = db.prepare(`
    INSERT INTO sessions
      (coach_id,chapter_id,sport_id,session_date,duration_minutes,participants,location,notes,submitted_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(coach_id||null, chapter_id||null, sport_id||null, session_date,
         duration_minutes||null, participants||null, location||null, notes||null, submitted_by||null);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/sessions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAdmin, (req, res) => {
  const total_sessions    = db.prepare('SELECT COUNT(*) as n FROM sessions').get().n;
  const total_participants = db.prepare('SELECT COALESCE(SUM(participants),0) as n FROM sessions').get().n;
  const active_coaches    = db.prepare("SELECT COUNT(*) as n FROM coaches WHERE active=1 AND name != 'Coach TBD'").get().n;
  const chapters_active   = db.prepare('SELECT COUNT(DISTINCT chapter_id) as n FROM sessions').get().n;

  const by_chapter = db.prepare(`
    SELECT chapters.name, COUNT(*) as sessions, COALESCE(SUM(sessions.participants),0) as participants
    FROM sessions JOIN chapters ON sessions.chapter_id=chapters.id
    GROUP BY chapters.id ORDER BY sessions DESC
  `).all();

  const by_sport = db.prepare(`
    SELECT sports.name, COUNT(*) as sessions
    FROM sessions JOIN sports ON sessions.sport_id=sports.id
    GROUP BY sports.id ORDER BY sessions DESC
  `).all();

  const recent = db.prepare(`
    SELECT sessions.session_date, coaches.name as coach, chapters.name as chapter, sports.name as sport, sessions.participants
    FROM sessions
    LEFT JOIN coaches  ON sessions.coach_id=coaches.id
    LEFT JOIN chapters ON sessions.chapter_id=chapters.id
    LEFT JOIN sports   ON sessions.sport_id=sports.id
    ORDER BY sessions.session_date DESC, sessions.id DESC LIMIT 5
  `).all();

  res.json({ total_sessions, total_participants, active_coaches, chapters_active, by_chapter, by_sport, recent });
});

// ── Photos ────────────────────────────────────────────────────────────────────
app.get('/api/photos', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT photos.*, chapters.name as chapter, sports.name as sport
    FROM photos
    LEFT JOIN chapters ON photos.chapter_id=chapters.id
    LEFT JOIN sports   ON photos.sport_id=sports.id
    ORDER BY photos.uploaded_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/photos', requireAdmin, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { caption, chapter_id, sport_id, session_id } = req.body;
  const r = db.prepare(`
    INSERT INTO photos (filename,caption,chapter_id,sport_id,session_id)
    VALUES (?,?,?,?,?)
  `).run(req.file.filename, caption||null, chapter_id||null, sport_id||null, session_id||null);
  res.json({ id: r.lastInsertRowid, filename: req.file.filename });
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

// ── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  res.json(s);
});

app.post('/api/settings', requireAdmin, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  Object.entries(req.body).forEach(([k, v]) => {
    if (k !== 'seeded') upsert.run(k, v);
  });
  res.json({ ok: true });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => console.log(`Together Sports running on http://localhost:${PORT}`));
