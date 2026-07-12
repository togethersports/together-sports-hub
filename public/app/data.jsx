/* data.jsx — API client, constants, shared helpers.
   Each app/*.jsx file runs in its own scope (Babel standalone), so shared
   code is published on window.TS. */

window.TS = window.TS || { views: {} };

(() => {
  const TS = window.TS;

  // ── Auth token ──────────────────────────────────────────
  TS.token = () => localStorage.getItem('ts_tok') || '';
  TS.setToken = (t) => t ? localStorage.setItem('ts_tok', t) : localStorage.removeItem('ts_tok');

  // ── API client ──────────────────────────────────────────
  // Throws Error(message) on any non-2xx so callers can toast it.
  TS.api = async (url, opts = {}) => {
    const headers = { 'x-admin-token': TS.token(), ...(opts.headers || {}) };
    if (opts.body && !(opts.body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      opts = { ...opts, body: JSON.stringify(opts.body) };
    }
    const res = await fetch(url, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 && TS.onUnauthorized) TS.onUnauthorized();
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  };

  // ── Constants ───────────────────────────────────────────
  TS.ACTIVITY_TYPES = [
    'Coaching Session', 'Community Outreach', 'Event / Tournament',
    'Mentoring', 'Fundraising', 'Admin / Planning', 'Other',
  ];
  TS.ACTIVITY_ICONS = {
    'Coaching Session': 'medal', 'Community Outreach': 'globe', 'Event / Tournament': 'trophy',
    'Mentoring': 'users', 'Fundraising': 'heart', 'Admin / Planning': 'clipboard', 'Other': 'sparkle',
  };
  TS.CHAPTER_FLAGS = {
    'NYC': '🗽', 'New Jersey': '🌉', 'Florida': '🌴',
    'Ohio': '🌰', 'Texas': '🤠', 'India': '🇮🇳',
  };
  TS.flag = (name) => TS.CHAPTER_FLAGS[name] || '📍';

  // Tag colors per sport (cycled for sports beyond the seeded four).
  const SPORT_STYLES = [
    { bg: 'var(--lime-soft)',   fg: '#3E6B12' },
    { bg: 'var(--peach-soft)',  fg: '#8A4A12' },
    { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
    { bg: '#E4E6F2',            fg: '#3A3F63' },
  ];
  const SPORT_INDEX = { Tennis: 0, Basketball: 1, Football: 2, Golf: 3 };
  TS.sportStyle = (name) => {
    if (!name) return { bg: 'var(--surface-2)', fg: 'var(--muted)' };
    const i = SPORT_INDEX[name] ?? Math.abs(TS.hash(name)) % SPORT_STYLES.length;
    return SPORT_STYLES[i];
  };

  TS.hash = (s) => {
    let h = 0;
    for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
    return h;
  };

  const AVATAR_COLORS = ['#285400', '#8A4A12', '#3A3F63', '#1B5E52', '#7A2E52', '#4E4A14'];
  TS.avatarColor = (name) => AVATAR_COLORS[Math.abs(TS.hash(name || '?')) % AVATAR_COLORS.length];
  TS.initials = (name) => String(name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Dates ───────────────────────────────────────────────
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Parse "YYYY-MM-DD" as a local date (new Date(str) would treat it as UTC).
  TS.parseDate = (s) => {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  TS.fmtDate = (s) => {
    const d = TS.parseDate(s);
    return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '—';
  };
  TS.fmtYear = (s) => { const d = TS.parseDate(s); return d ? String(d.getFullYear()) : ''; };
  TS.fmtFull = (s) => {
    const d = TS.parseDate(s);
    return d ? `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '—';
  };
  TS.today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  TS.daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  TS.fmtHours = (h) => {
    const n = Number(h) || 0;
    return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`;
  };
  TS.fmtDuration = (mins) => {
    const n = Number(mins) || 0;
    if (!n) return '—';
    if (n < 60) return `${n}m`;
    return n % 60 === 0 ? `${n / 60}h` : `${Math.floor(n / 60)}h ${n % 60}m`;
  };

  // ── CSV export ──────────────────────────────────────────
  TS.exportCsv = (filename, headers, rows) => {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  TS.genAccessCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const buf = new Uint32Array(6);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 6; i++) code += chars[buf[i] % chars.length];
    return code;
  };
})();
