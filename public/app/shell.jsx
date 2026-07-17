/* shell.jsx — sidebar, topbar, login screen. */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useRef } = React;
  const { Ic, Btn, IconBtn, Kbd, Avatar, Field, Input } = TS.ui;

  const NAV = [
    { label: 'Program', items: [
      { id: 'overview', label: 'Overview', icon: 'home' },
      { id: 'sessions', label: 'Sessions', icon: 'calendar' },
      { id: 'volunteer', label: 'Volunteer Logs', icon: 'heart' },
      { id: 'participants', label: 'Participants', icon: 'contact' },
    ]},
    { label: 'People', items: [
      { id: 'roster', label: 'Coaches', icon: 'whistle' },
      { id: 'manage', label: 'Manage Coaches', icon: 'users' },
      { id: 'partners', label: 'Partner Log', icon: 'globe' },
    ]},
    { label: 'Content', items: [
      { id: 'gallery', label: 'Gallery', icon: 'image' },
      { id: 'approvals', label: 'Approvals', icon: 'badge-check', badge: 'pending' },
    ]},
    { label: 'System', items: [
      { id: 'settings', label: 'Settings', icon: 'sliders' },
    ]},
  ];
  TS.NAV = NAV;

  const Sidebar = ({ view, setView, pendingCount, monthSessions, monthGoal }) => {
    const pct = monthGoal > 0 ? Math.min(100, Math.round((monthSessions / monthGoal) * 100)) : 0;
    return (
      <nav className="ts-sb">
        <div className="ts-brand">
          <img className="ts-logo-img" src="assets/ts-mark.png" alt="" />
          <div>
            <div className="ts-brandname">Together Sports</div>
            <div className="ts-brandsub">Admin HQ</div>
          </div>
        </div>

        <button className={`ts-quickadd${view === 'add' ? ' is-active' : ''}`} onClick={() => setView('add')}>
          <Ic name="calendar-plus" size={17} />
          <span>Log a session</span>
          <Kbd>N</Kbd>
        </button>

        {NAV.map((group) => (
          <React.Fragment key={group.label}>
            <div className="ts-navlabel">{group.label}</div>
            <div className="ts-nav">
              {group.items.map((it) => (
                <button key={it.id} className={`ts-navitem${view === it.id ? ' is-active' : ''}`}
                        onClick={() => setView(it.id)}>
                  <Ic name={it.icon} size={17} />
                  <span>{it.label}</span>
                  {it.badge === 'pending' && pendingCount > 0 && <span className="ts-navbadge">{pendingCount}</span>}
                </button>
              ))}
            </div>
          </React.Fragment>
        ))}

        <div className="ts-sbfoot">
          <div className="ts-sbcard">
            <div className="ts-sbcard-k">This month</div>
            <div className="ts-sbcard-v">{monthSessions} session{monthSessions === 1 ? '' : 's'}</div>
            <div className="ts-sbcard-bar"><span style={{ width: `${pct}%` }} /></div>
            <div className="ts-sbcard-sub">Goal: {monthGoal} · {pct}% there</div>
          </div>
        </div>
      </nav>
    );
  };

  // Close-on-outside-click helper for topbar menus.
  const useOutside = (ref, onClose) => {
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      document.addEventListener('mousedown', h);
      return () => document.removeEventListener('mousedown', h);
    }, [ref, onClose]);
  };

  const ChapterSelect = ({ chapters, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(ref, () => setOpen(false));
    const current = chapters.find((c) => c.id === value);
    return (
      <div className="ts-chapsel" ref={ref}>
        <button className="ts-chip" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open}>
          <Ic name="pin" size={15} />
          {current ? current.name : 'All chapters'}
          <Ic name="chev-down" size={14} />
        </button>
        {open && (
          <div className="ts-menu" role="menu">
            <button className={`ts-menu-item${value == null ? ' is-active' : ''}`}
                    onClick={() => { onChange(null); setOpen(false); }}>
              <span className="ts-menu-flag">🌍</span> All chapters
            </button>
            {chapters.map((c) => (
              <button key={c.id} className={`ts-menu-item${value === c.id ? ' is-active' : ''}`}
                      onClick={() => { onChange(c.id); setOpen(false); }}>
                <span className="ts-menu-flag">{TS.flag(c.name)}</span> {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Bell = ({ feed }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(ref, () => setOpen(false));
    return (
      <div className="ts-bellwrap" ref={ref}>
        <button className="ts-iconbtn" onClick={() => setOpen(!open)} aria-label="Activity" aria-expanded={open}>
          <Ic name="bell" size={17} />
        </button>
        {open && (
          <div className="ts-menu ts-menu--feed">
            <div className="ts-feedhead">Recent activity</div>
            {feed.length === 0 && <div className="ts-pal-empty">Nothing yet — log a session to get things moving.</div>}
            {feed.map((f, i) => (
              <div className="ts-feedrow" key={i}>
                <span className="ts-feed-ic"><Ic name={f.icon} size={15} /></span>
                <div>
                  <div className="ts-feed-text">{f.text}</div>
                  <div className="ts-feed-sub">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Topbar = ({ chapters, chapterFilter, setChapterFilter, feed, onSearch, onLogout }) => (
    <div className="ts-top">
      <button className="ts-searchbtn" onClick={onSearch}>
        <Ic name="search" size={15.5} />
        Search sessions, coaches, actions…
        <Kbd>⌘K</Kbd>
      </button>
      <div className="ts-topright">
        <ChapterSelect chapters={chapters} value={chapterFilter} onChange={setChapterFilter} />
        <Bell feed={feed} />
        <div className="ts-topdiv" />
        <div className="ts-userchip">
          <span className="ts-avatar">TS</span>
          <div className="ts-usermeta">
            <span className="ts-username">Together Sports</span>
            <span className="ts-userrole">Administrator</span>
          </div>
        </div>
        <IconBtn icon="logout" title="Sign out" onClick={onLogout} />
      </div>
    </div>
  );

  const Login = ({ onLogin }) => {
    const [pw, setPw] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
      fetch('/api/impact-stats').then((r) => r.json()).then(setStats).catch(() => {});
    }, []);

    const submit = async (e) => {
      e.preventDefault();
      if (!pw || busy) return;
      setBusy(true);
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        });
        if (!res.ok) throw new Error('That password didn’t match. Try again.');
        TS.setToken(pw);
        onLogin();
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="ts-login">
        <div className="ts-login-hero">
          <div className="ts-login-brand">
            <img src="assets/ts-mark.png" alt="" />
            <div>
              <div className="ts-login-brandname">Together Sports</div>
              <div className="ts-login-brandsub">Admin HQ</div>
            </div>
          </div>
          <div className="ts-login-copy">
            <h1>Every session counts.<br />Here&rsquo;s where they add up.</h1>
            <p>Track sessions, volunteer hours, coaches and stories across every chapter — all in one place.</p>
          </div>
          <div className="ts-login-stats">
            <div className="ts-login-stat"><b>{stats ? stats.total_sessions : '–'}</b><span>sessions logged</span></div>
            <div className="ts-login-stat"><b>{stats ? stats.active_coaches : '–'}</b><span>active coaches</span></div>
            <div className="ts-login-stat"><b>{stats ? stats.total_participants + stats.total_people_helped : '–'}</b><span>people reached</span></div>
          </div>
        </div>
        <div className="ts-login-panel">
          <form className="ts-login-card" onSubmit={submit}>
            <h2>Welcome back</h2>
            <p className="ts-lede">Enter the admin password to open the dashboard.</p>
            <Field label="Admin password" error={err}>
              <Input type="password" value={pw} autoFocus placeholder="••••••••••••"
                     invalid={!!err}
                     onChange={(e) => { setPw(e.target.value); setErr(''); }} />
            </Field>
            <Btn kind="primary" full type="submit" disabled={busy || !pw} icon="shield">
              {busy ? 'Checking…' : 'Open dashboard'}
            </Btn>
            <div className="ts-login-links">
              <a href="/coach.html"><Ic name="whistle" size={14} /> Coach portal</a>
              <a href="/impact.html"><Ic name="globe" size={14} /> Public impact page</a>
            </div>
          </form>
        </div>
      </div>
    );
  };

  TS.shell = { Sidebar, Topbar, Login };
})();
