/* app.jsx — root: auth gate, data store, routing, keyboard shortcuts. */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useCallback, useMemo, useRef } = React;
  const { ToastProvider, useToast, Loading } = TS.ui;
  const { Sidebar, Topbar, Login } = TS.shell;

  const EMPTY = {
    chapters: [], sports: [], coaches: [], sessions: [], volunteerLogs: [],
    testimonials: [], photos: [], participants: [], stats: null, settings: {},
  };

  const Dashboard = ({ onLogout }) => {
    const toast = useToast();
    const [route, setRoute] = useState({ view: 'overview', param: null });
    const [chapterFilter, setChapterFilter] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [data, setData] = useState(EMPTY);
    const [loaded, setLoaded] = useState(false);
    const galleryUpload = useRef(false);

    const setView = useCallback((view, param = null) => {
      setRoute({ view, param });
      document.querySelector('.ts-content')?.scrollTo(0, 0);
    }, []);

    const reload = useCallback(async () => {
      try {
        const [chapters, sports, coaches, sessions, volunteerLogs, testimonials, photos, participants, stats, settings] =
          await Promise.all([
            TS.api('/api/chapters'), TS.api('/api/sports'), TS.api('/api/coaches'),
            TS.api('/api/sessions'), TS.api('/api/volunteer-logs'), TS.api('/api/testimonials'),
            TS.api('/api/photos'), TS.api('/api/participants'), TS.api('/api/stats'), TS.api('/api/settings'),
          ]);
        setData({ chapters, sports, coaches, sessions, volunteerLogs, testimonials, photos, participants, stats, settings });
        setLoaded(true);
      } catch (e) {
        toast(`Couldn’t load data: ${e.message}`, { error: true });
      }
    }, [toast]);

    useEffect(() => { reload(); }, [reload]);

    // Keyboard: ⌘K palette, N → log a session (when not typing in a field).
    useEffect(() => {
      const h = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setPaletteOpen((o) => !o);
          return;
        }
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) ||
                       document.activeElement?.isContentEditable;
        if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
          e.preventDefault();
          setView('add');
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [setView]);

    const pendingCount =
      data.testimonials.filter((t) => !t.approved).length +
      data.photos.filter((p) => !p.approved).length;

    const monthPrefix = TS.today().slice(0, 7);
    const monthSessions = data.sessions.filter((s) => (s.session_date || '').startsWith(monthPrefix)).length;
    const monthGoal = Number(data.settings.monthly_goal) || 20;

    const feed = useMemo(() => {
      const items = [];
      for (const s of data.sessions.slice(0, 4)) {
        items.push({
          icon: 'calendar', when: s.created_at || s.session_date,
          text: `${s.coach || 'A coach'} logged ${s.sport || 'a session'}${s.chapter ? ` in ${s.chapter}` : ''}`,
          sub: `${s.participants || 0} kids · ${TS.fmtDate(s.session_date)}`,
        });
      }
      for (const t of data.testimonials.filter((x) => !x.approved).slice(0, 3)) {
        items.push({
          icon: 'quote', when: t.created_at,
          text: `New story from ${t.coach_name}`,
          sub: 'Waiting for review',
        });
      }
      for (const v of data.volunteerLogs.slice(0, 2)) {
        items.push({
          icon: 'heart', when: v.created_at || v.log_date,
          text: `${v.coach || 'A coach'} logged ${TS.fmtHours(v.hours)} of ${v.activity_type}`,
          sub: TS.fmtDate(v.log_date),
        });
      }
      return items.sort((a, b) => String(b.when).localeCompare(String(a.when))).slice(0, 6);
    }, [data]);

    const onPaletteAction = useCallback((action, arg) => {
      if (action === 'logout') onLogout();
      else if (action === 'export-sessions') {
        TS.exportCsv('sessions.csv',
          ['Date', 'Coach', 'Chapter', 'Sport', 'Kids', 'Duration (min)', 'Location', 'Notes'],
          data.sessions.map((s) => [s.session_date, s.coach, s.chapter, s.sport, s.participants, s.duration_minutes, s.location, s.notes]));
        toast('Sessions CSV downloaded');
      } else if (action === 'export-volunteer') {
        TS.exportCsv('volunteer-logs.csv',
          ['Date', 'Coach', 'Activity', 'People helped', 'Hours', 'Chapter', 'Description'],
          data.volunteerLogs.map((v) => [v.log_date, v.coach, v.activity_type, v.people_helped, v.hours, v.chapter, v.description]));
        toast('Volunteer logs CSV downloaded');
      } else if (action === 'upload-photo') {
        galleryUpload.current = true;
        setView('gallery', { upload: true });
      } else if (action === 'open-coach') {
        setView('roster', { coachId: arg.id });
      }
    }, [data, onLogout, setView, toast]);

    const ViewComp = TS.views[route.view] || TS.views.overview;

    return (
      <div className="app">
        <Sidebar view={route.view} setView={setView} pendingCount={pendingCount}
                 monthSessions={monthSessions} monthGoal={monthGoal} />
        <div className="ts-main">
          <Topbar chapters={data.chapters} chapterFilter={chapterFilter} setChapterFilter={setChapterFilter}
                  feed={feed} onSearch={() => setPaletteOpen(true)} onLogout={onLogout} />
          <div className="ts-content">
            <div className="ts-content-inner" key={route.view}>
              {!loaded
                ? <Loading label="Loading dashboard…" />
                : <ViewComp data={data} reload={reload} setView={setView}
                            param={route.param} chapterFilter={chapterFilter} toast={toast} />}
            </div>
          </div>
        </div>
        <TS.Palette open={paletteOpen} onClose={() => setPaletteOpen(false)}
                    coaches={data.coaches} onNav={setView} onAction={onPaletteAction} />
      </div>
    );
  };

  const Root = () => {
    const [authed, setAuthed] = useState(!!TS.token());

    useEffect(() => {
      TS.onUnauthorized = () => { TS.setToken(''); setAuthed(false); };
      return () => { TS.onUnauthorized = null; };
    }, []);

    const logout = () => { TS.setToken(''); setAuthed(false); };

    return (
      <ToastProvider>
        {authed ? <Dashboard onLogout={logout} /> : <Login onLogin={() => setAuthed(true)} />}
      </ToastProvider>
    );
  };

  ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
})();
