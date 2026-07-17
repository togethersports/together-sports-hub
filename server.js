'use strict';

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const Database = require('better-sqlite3');
const Anthropic = require('@anthropic-ai/sdk');

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
  CREATE TABLE IF NOT EXISTS outreach_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER REFERENCES chapters(id),
    created_by INTEGER REFERENCES coaches(id),
    name TEXT NOT NULL,
    organization TEXT,
    role TEXT,
    track TEXT NOT NULL DEFAULT 'Partner',
    email TEXT,
    phone TEXT,
    stage TEXT NOT NULL DEFAULT 'New',
    notes TEXT,
    next_action TEXT,
    last_touch TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS outreach_touches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES outreach_contacts(id),
    coach_id INTEGER REFERENCES coaches(id),
    touch_date TEXT NOT NULL,
    type TEXT NOT NULL,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS outreach_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER REFERENCES chapters(id),
    created_by INTEGER REFERENCES coaches(id),
    title TEXT NOT NULL,
    event_date TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'Idea',
    goal TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS view_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    key_code TEXT UNIQUE NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
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

// Coach auth via access code header; admin token also passes (req.isAdmin).
function requireCoach(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t === ADMIN_PASSWORD) { req.coach = null; req.isAdmin = true; return next(); }
  const code = req.headers['x-coach-code'];
  if (!code) return res.status(401).json({ error: 'Unauthorized' });
  const coach = get(
    "SELECT id,name,chapter_id,sport_id FROM coaches WHERE UPPER(access_code)=UPPER(?) AND active=1 AND name!='Coach TBD'",
    [String(code).trim()]
  );
  if (!coach) return res.status(401).json({ error: 'Invalid access code' });
  req.coach = coach;
  req.isAdmin = false;
  next();
}

// Read-only viewer auth: a shareable key (Settings → Shareable links), or the
// admin token. Grants read access to the same depth as the admin dashboard —
// including participant/parent contact info — but no write endpoint accepts
// a view key, so a viewer can never create, edit, or delete anything.
function requireViewer(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t === ADMIN_PASSWORD) { req.isAdmin = true; return next(); }
  const key = req.headers['x-view-key'] || req.query.view_key;
  if (!key) return res.status(401).json({ error: 'Unauthorized' });
  const vk = get('SELECT * FROM view_keys WHERE key_code=? AND active=1', [String(key).trim()]);
  if (!vk) return res.status(401).json({ error: 'Invalid or revoked key' });
  run("UPDATE view_keys SET last_used_at=datetime('now') WHERE id=?", [vk.id]);
  req.isAdmin = false;
  req.viewKey = vk;
  next();
}

function genViewKey() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(24);
  let out = '';
  for (let i = 0; i < 24; i++) out += chars[buf[i] % chars.length];
  return out;
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
    "SELECT id,name,chapter_id,sport_id FROM coaches WHERE UPPER(access_code)=UPPER(?) AND active=1 AND name!='Coach TBD'",
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

// ── Shareable view-only links ───────────────────────────────────────────────
// Admin-managed keys that unlock the read-only viewer dashboard (viewer.html)
// — full depth (sessions, participants, parent contacts, coaches, stories,
// photos) but no create/edit/delete: no write route accepts a view key.
app.get('/api/view-keys', requireAdmin, (req, res) => {
  res.json(all('SELECT id,label,key_code,active,created_at,last_used_at FROM view_keys ORDER BY created_at DESC'));
});
app.post('/api/view-keys', requireAdmin, (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) return res.status(400).json({ error: 'Label required' });
  const key_code = genViewKey();
  const r = run('INSERT INTO view_keys (label,key_code) VALUES (?,?)', [label.trim(), key_code]);
  res.json({ id: r.lastInsertRowid, label: label.trim(), key_code, active: 1 });
});
app.delete('/api/view-keys/:id', requireAdmin, (req, res) => {
  run('DELETE FROM view_keys WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Viewer dashboard data (read-only) ───────────────────────────────────────
app.get('/api/viewer/bundle', requireViewer, (req, res) => {
  const sessions = all(`
    SELECT s.id, s.session_date, s.duration_minutes, s.participants, s.location, s.notes,
           c.name AS coach, ch.name AS chapter, sp.name AS sport
    FROM sessions s
    LEFT JOIN coaches c ON s.coach_id=c.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    ORDER BY s.session_date DESC, s.id DESC
  `);
  const participants = all(`
    SELECT p.id, p.name, p.parent_name, p.parent_contact,
           s.session_date, s.location, ch.name AS chapter, sp.name AS sport, c.name AS coach
    FROM participants p
    LEFT JOIN sessions s ON p.session_id=s.id
    LEFT JOIN coaches c ON s.coach_id=c.id
    LEFT JOIN chapters ch ON s.chapter_id=ch.id
    LEFT JOIN sports sp ON s.sport_id=sp.id
    ORDER BY p.created_at DESC
  `);
  const volunteerLogs = all(`
    SELECT v.id, v.log_date, v.activity_type, v.description, v.people_helped, v.hours,
           c.name AS coach, ch.name AS chapter
    FROM volunteer_logs v
    LEFT JOIN coaches c ON v.coach_id=c.id
    LEFT JOIN chapters ch ON v.chapter_id=ch.id
    ORDER BY v.log_date DESC, v.id DESC
  `);
  const testimonials = all(`
    SELECT t.id, t.coach_name, t.quote, t.parent_name, t.parent_contact, t.child_name,
           t.approved, t.public, t.photo_filename, ch.name AS chapter, sp.name AS sport, t.created_at
    FROM testimonials t
    LEFT JOIN chapters ch ON t.chapter_id=ch.id
    LEFT JOIN sports sp ON t.sport_id=sp.id
    ORDER BY t.created_at DESC
  `).map(r => ({ ...r, photo_url: r.photo_filename ? `/uploads/${r.photo_filename}` : null }));
  const photos = all(`
    SELECT p.id, p.filename, p.caption, p.approved, p.uploaded_at, ch.name AS chapter, sp.name AS sport
    FROM photos p
    LEFT JOIN chapters ch ON p.chapter_id=ch.id
    LEFT JOIN sports sp ON p.sport_id=sp.id
    ORDER BY p.uploaded_at DESC
  `).map(r => ({ ...r, url: `/uploads/${r.filename}` }));
  const coaches = all(`
    SELECT c.id, c.name, c.email, c.phone, c.bio, c.active, ch.name AS chapter, sp.name AS sport
    FROM coaches c
    LEFT JOIN chapters ch ON c.chapter_id=ch.id
    LEFT JOIN sports sp ON c.sport_id=sp.id
    WHERE c.name != 'Coach TBD'
    ORDER BY c.name
  `);
  const stats = {
    total_sessions:      get('SELECT COUNT(*) n FROM sessions').n,
    total_participants:  get('SELECT COALESCE(SUM(participants),0) n FROM sessions').n,
    active_coaches:      get("SELECT COUNT(*) n FROM coaches WHERE active=1 AND name!='Coach TBD'").n,
    total_hours:         get('SELECT COALESCE(SUM(hours),0) n FROM volunteer_logs').n,
    by_chapter: all(`SELECT ch.name, COUNT(*) sessions, COALESCE(SUM(s.participants),0) participants
                     FROM sessions s JOIN chapters ch ON s.chapter_id=ch.id GROUP BY ch.id ORDER BY sessions DESC`),
    by_sport:   all(`SELECT sp.name, COUNT(*) sessions FROM sessions s JOIN sports sp ON s.sport_id=sp.id GROUP BY sp.id ORDER BY sessions DESC`),
  };
  res.json({
    org_label: req.isAdmin ? 'Admin preview' : req.viewKey.label,
    stats, sessions, participants, volunteerLogs, testimonials, photos, coaches,
  });
});

// ── Outreach (per-chapter, coach-facing) ──────────────────────────────────────
// Rows are scoped to the coach's chapter so co-coaches can collaborate; a coach
// with no chapter sees only rows they created. Admin sees everything.

function outreachScope(req, alias) {
  if (req.isAdmin) {
    if (req.query.chapter_id) return { sql: ` AND ${alias}.chapter_id=?`, args: [req.query.chapter_id] };
    return { sql: '', args: [] };
  }
  if (req.coach.chapter_id != null) {
    return { sql: ` AND (${alias}.chapter_id=? OR ${alias}.created_by=?)`, args: [req.coach.chapter_id, req.coach.id] };
  }
  return { sql: ` AND ${alias}.created_by=?`, args: [req.coach.id] };
}

function outreachRow(req, table, id) {
  const scope = outreachScope(req, 't');
  return get(`SELECT t.* FROM ${table} t WHERE t.id=?${scope.sql}`, [id, ...scope.args]);
}

app.get('/api/outreach/contacts', requireCoach, (req, res) => {
  const scope = outreachScope(req, 'o');
  res.json(all(`
    SELECT o.*, ch.name AS chapter, c.name AS created_by_name
    FROM outreach_contacts o
    LEFT JOIN chapters ch ON o.chapter_id=ch.id
    LEFT JOIN coaches c ON o.created_by=c.id
    WHERE 1=1${scope.sql}
    ORDER BY o.created_at DESC
  `, scope.args));
});

app.post('/api/outreach/contacts', requireCoach, (req, res) => {
  const { name, organization, role, track, email, phone, stage, notes, next_action } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const chapter_id = req.isAdmin ? (req.body.chapter_id || null) : req.coach.chapter_id;
  const r = run(
    'INSERT INTO outreach_contacts (chapter_id,created_by,name,organization,role,track,email,phone,stage,notes,next_action) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [chapter_id, req.coach?.id || null, name, organization || null, role || null, track || 'Partner',
     email || null, phone || null, stage || 'New', notes || null, next_action || null]
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/outreach/contacts/:id', requireCoach, (req, res) => {
  const existing = outreachRow(req, 'outreach_contacts', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const f = { ...existing, ...req.body };
  run(
    'UPDATE outreach_contacts SET name=?,organization=?,role=?,track=?,email=?,phone=?,stage=?,notes=?,next_action=?,last_touch=? WHERE id=?',
    [f.name, f.organization || null, f.role || null, f.track || 'Partner', f.email || null, f.phone || null,
     f.stage || 'New', f.notes || null, f.next_action || null, f.last_touch || null, req.params.id]
  );
  res.json({ ok: true });
});

app.delete('/api/outreach/contacts/:id', requireCoach, (req, res) => {
  const existing = outreachRow(req, 'outreach_contacts', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  run('DELETE FROM outreach_touches WHERE contact_id=?', [req.params.id]);
  run('DELETE FROM outreach_contacts WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/outreach/touches', requireCoach, (req, res) => {
  if (!req.query.contact_id) return res.status(400).json({ error: 'contact_id required' });
  const contact = outreachRow(req, 'outreach_contacts', req.query.contact_id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json(all(`
    SELECT t.*, c.name AS coach FROM outreach_touches t
    LEFT JOIN coaches c ON t.coach_id=c.id
    WHERE t.contact_id=? ORDER BY t.touch_date DESC, t.id DESC
  `, [req.query.contact_id]));
});

app.post('/api/outreach/touches', requireCoach, (req, res) => {
  const { contact_id, touch_date, type, summary, stage, next_action } = req.body;
  if (!contact_id || !touch_date || !type) return res.status(400).json({ error: 'contact_id, touch_date and type required' });
  const contact = outreachRow(req, 'outreach_contacts', contact_id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  const r = run(
    'INSERT INTO outreach_touches (contact_id,coach_id,touch_date,type,summary) VALUES (?,?,?,?,?)',
    [contact_id, req.coach?.id || null, touch_date, type, summary || null]
  );
  run('UPDATE outreach_contacts SET last_touch=?, stage=?, next_action=? WHERE id=?',
    [touch_date, stage || contact.stage, next_action !== undefined ? next_action : contact.next_action, contact_id]);
  res.json({ id: r.lastInsertRowid });
});

app.get('/api/outreach/events', requireCoach, (req, res) => {
  const scope = outreachScope(req, 'o');
  res.json(all(`
    SELECT o.*, ch.name AS chapter, c.name AS created_by_name
    FROM outreach_events o
    LEFT JOIN chapters ch ON o.chapter_id=ch.id
    LEFT JOIN coaches c ON o.created_by=c.id
    WHERE 1=1${scope.sql}
    ORDER BY CASE WHEN o.event_date IS NULL THEN 1 ELSE 0 END, o.event_date ASC, o.id DESC
  `, scope.args));
});

app.post('/api/outreach/events', requireCoach, (req, res) => {
  const { title, event_date, location, status, goal, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const chapter_id = req.isAdmin ? (req.body.chapter_id || null) : req.coach.chapter_id;
  const r = run(
    'INSERT INTO outreach_events (chapter_id,created_by,title,event_date,location,status,goal,notes) VALUES (?,?,?,?,?,?,?,?)',
    [chapter_id, req.coach?.id || null, title, event_date || null, location || null, status || 'Idea', goal || null, notes || null]
  );
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/outreach/events/:id', requireCoach, (req, res) => {
  const existing = outreachRow(req, 'outreach_events', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const f = { ...existing, ...req.body };
  run('UPDATE outreach_events SET title=?,event_date=?,location=?,status=?,goal=?,notes=? WHERE id=?',
    [f.title, f.event_date || null, f.location || null, f.status || 'Idea', f.goal || null, f.notes || null, req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/outreach/events/:id', requireCoach, (req, res) => {
  const existing = outreachRow(req, 'outreach_events', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  run('DELETE FROM outreach_events WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── AI assist (drafting only) ─────────────────────────────────────────────────
// Hard rule, enforced by architecture: this server can DRAFT outreach but has
// no ability to send anything — no mail credentials, no send endpoint exist.
// The coach copies the draft into their own email/text app.

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const ASSIST_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Simple per-user hourly cap so a stuck client can't burn the API budget.
const assistUsage = new Map();
function assistAllowed(key) {
  const now = Date.now();
  const u = assistUsage.get(key);
  if (!u || now > u.resetAt) { assistUsage.set(key, { count: 1, resetAt: now + 3600_000 }); return true; }
  if (u.count >= 25) return false;
  u.count++;
  return true;
}

function chapterContext(chapterId) {
  if (!chapterId) return 'No chapter is assigned yet.';
  const ch = get('SELECT name FROM chapters WHERE id=?', [chapterId]);
  if (!ch) return 'No chapter is assigned yet.';
  const s = get(`SELECT COUNT(*) n, COALESCE(SUM(participants),0) kids FROM sessions WHERE chapter_id=?`, [chapterId]);
  const sports = all(`SELECT DISTINCT sp.name FROM sessions s JOIN sports sp ON s.sport_id=sp.id WHERE s.chapter_id=?`, [chapterId]).map(r => r.name);
  const coaches = get(`SELECT COUNT(*) n FROM coaches WHERE chapter_id=? AND active=1 AND name!='Coach TBD'`, [chapterId]).n;
  const hours = get(`SELECT COALESCE(SUM(hours),0) h FROM volunteer_logs WHERE chapter_id=?`, [chapterId]).h;
  return `Chapter: ${ch.name}. Sessions run so far: ${s.n} (reaching ${s.kids} kids). ` +
         `Sports played: ${sports.join(', ') || 'not recorded yet'}. Active coaches: ${coaches}. Volunteer hours logged: ${hours}.`;
}

app.post('/api/assist', requireCoach, async (req, res) => {
  if (!anthropic) {
    return res.status(503).json({ error: 'AI assist isn’t configured yet — set ANTHROPIC_API_KEY on the server to turn it on.' });
  }
  const userKey = req.isAdmin ? 'admin' : `coach:${req.coach.id}`;
  if (!assistAllowed(userKey)) {
    return res.status(429).json({ error: 'You’ve hit the hourly limit for AI drafts — try again in a bit.' });
  }

  const { kind, contact_id, event_id, instructions } = req.body || {};
  const orgName = get("SELECT value FROM settings WHERE key='org_name'")?.value || 'Together Sports';
  const contactEmail = get("SELECT value FROM settings WHERE key='contact_email'")?.value || '';
  const coachName = req.coach?.name || 'the program admin';
  const chapterId = req.isAdmin ? null : req.coach.chapter_id;

  const system = [
    `You are the outreach assistant for ${orgName}, a volunteer-run youth sports nonprofit where coaches run free sports sessions for kids in their local chapters.`,
    `You are helping ${coachName} with chapter outreach: partners, venues, donors, volunteers, and families.`,
    `Context about this chapter: ${chapterContext(chapterId)}`,
    contactEmail ? `Org contact email: ${contactEmail}.` : '',
    '',
    'HARD RULES:',
    '1. You produce DRAFTS only. The coach sends everything themselves — never imply a message has been or will be sent automatically.',
    '2. Never invent statistics, names, commitments, or facts. Only use the numbers and details given above or in the request. Where a needed detail is unknown, put a [bracketed placeholder].',
    '3. Voice: warm, genuine, concise, community-minded. No corporate jargon, no hype, no pressure tactics. Emails under 150 words unless asked otherwise.',
    '4. This is grassroots volunteer outreach to real neighbors — write like a person, not a marketing team.',
  ].filter(Boolean).join('\n');

  let prompt;
  try {
    if (kind === 'draft-intro' || kind === 'draft-followup') {
      const c = outreachRow(req, 'outreach_contacts', contact_id);
      if (!c) return res.status(404).json({ error: 'Contact not found' });
      const who = `${c.name}${c.role ? `, ${c.role}` : ''}${c.organization ? ` at ${c.organization}` : ''} (track: ${c.track}${c.email ? `, email: ${c.email}` : ''})`;
      const notes = c.notes ? `Notes about them: ${c.notes}` : '';
      if (kind === 'draft-intro') {
        prompt = `Draft a first outreach message from ${coachName} to ${who}. ${notes}\n` +
          `Goal: open a conversation about how they could get involved with the chapter (as a ${c.track.toLowerCase()}). ` +
          `Include a specific, low-commitment ask (a 15-minute chat, or coming to watch a session). Provide a subject line, then the message.` +
          (instructions ? `\nAdditional instructions from the coach: ${instructions}` : '');
      } else {
        const touches = all('SELECT touch_date,type,summary FROM outreach_touches WHERE contact_id=? ORDER BY touch_date DESC LIMIT 6', [c.id]);
        const history = touches.length
          ? `Contact history (newest first):\n${touches.map(t => `- ${t.touch_date} ${t.type}: ${t.summary || 'no summary'}`).join('\n')}`
          : 'No previous touches are logged.';
        prompt = `Draft a follow-up message from ${coachName} to ${who}. Their pipeline stage is "${c.stage}". ${notes}\n${history}\n` +
          `Goal: move the conversation forward naturally without being pushy. Reference the history where it helps. Provide a subject line, then the message.` +
          (instructions ? `\nAdditional instructions from the coach: ${instructions}` : '');
      }
    } else if (kind === 'plan-event') {
      const e = outreachRow(req, 'outreach_events', event_id);
      if (!e) return res.status(404).json({ error: 'Event not found' });
      prompt = `Help ${coachName} plan this chapter event:\n` +
        `Title: ${e.title}\nDate: ${e.event_date || 'not set'}\nLocation: ${e.location || 'not set'}\nStatus: ${e.status}\n` +
        `Goal: ${e.goal || 'not written down yet'}\nNotes so far: ${e.notes || 'none'}\n\n` +
        `Produce a practical plan: (1) a short checklist working back from the event date, (2) who to reach out to (types of partners/volunteers, not invented names), ` +
        `(3) a day-of run sheet, (4) one draft promo blurb families would actually read. Keep it grounded in what one volunteer coach can realistically do.` +
        (instructions ? `\nAdditional instructions from the coach: ${instructions}` : '');
    } else if (kind === 'week-plan') {
      const scope = outreachScope(req, 'o');
      const contacts = all(`SELECT o.name, o.organization, o.track, o.stage, o.next_action, o.last_touch FROM outreach_contacts o WHERE 1=1${scope.sql} ORDER BY o.next_action IS NULL, o.next_action LIMIT 30`, scope.args);
      const events = all(`SELECT o.title, o.event_date, o.status, o.goal FROM outreach_events o WHERE o.status != 'Done'${scope.sql} LIMIT 15`, scope.args);
      prompt = `Today is ${new Date().toISOString().slice(0, 10)}. Here is ${coachName}'s current outreach pipeline:\n\n` +
        `CONTACTS:\n${contacts.length ? contacts.map(c => `- ${c.name}${c.organization ? ` (${c.organization})` : ''} · ${c.track} · stage: ${c.stage} · next action due: ${c.next_action || 'none set'} · last touch: ${c.last_touch || 'never'}`).join('\n') : '(none yet)'}\n\n` +
        `UPCOMING EVENTS:\n${events.length ? events.map(e => `- ${e.title} · ${e.event_date || 'no date'} · ${e.status}${e.goal ? ` · goal: ${e.goal}` : ''}`).join('\n') : '(none yet)'}\n\n` +
        `Suggest the 3-5 highest-impact outreach actions for this week, in priority order, each with a one-line reason and a concrete first step. ` +
        `If the pipeline is empty, suggest realistic ways a volunteer coach can find their first partners and families locally.` +
        (instructions ? `\nAdditional instructions from the coach: ${instructions}` : '');
    } else {
      return res.status(400).json({ error: 'Unknown assist kind' });
    }

    const msg = await anthropic.messages.create({
      model: ASSIST_MODEL,
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      output_config: { effort: kind === 'draft-intro' || kind === 'draft-followup' ? 'low' : 'medium' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    if (msg.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'The assistant declined this request — try rephrasing it.' });
    }
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) return res.status(502).json({ error: 'The assistant returned an empty draft — try again.' });
    res.json({ text, model: msg.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: 'The AI key on the server is invalid — check ANTHROPIC_API_KEY.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'The AI service is busy — try again in a minute.' });
    }
    console.error('assist error:', err.message);
    res.status(502).json({ error: 'AI assist hit a snag — try again in a moment.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => console.log(`Together Sports → http://localhost:${PORT}`));
