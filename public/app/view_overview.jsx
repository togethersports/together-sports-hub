/* view_overview.jsx — landing view: stats, weekly chart, recent sessions,
   needs-attention, latest photos, chapter breakdown. */

(() => {
  const TS = window.TS;
  const { useMemo } = React;
  const { Ic, Btn, PageHead, SportTag, Avatar, Empty } = TS.ui;

  const CHART_COLORS = ['var(--accent)', 'var(--peach)', 'var(--lime)', '#3A3F63', '#B36A24', '#1B5E52'];

  const Overview = ({ data, setView, chapterFilter }) => {
    const inChapter = (row) => chapterFilter == null || row.chapter_id === chapterFilter;
    const sessions = data.sessions.filter(inChapter);
    const vols = data.volunteerLogs.filter(inChapter);

    const kidsReached = sessions.reduce((n, s) => n + (Number(s.participants) || 0), 0)
                      + vols.reduce((n, v) => n + (Number(v.people_helped) || 0), 0);
    const volHours = vols.reduce((n, v) => n + (Number(v.hours) || 0), 0);
    const activeCoaches = data.coaches.filter((c) =>
      c.active && c.name !== 'Coach TBD' && (chapterFilter == null || c.chapter_id === chapterFilter)).length;

    const d30 = TS.daysAgo(30), d60 = TS.daysAgo(60);
    const last30 = sessions.filter((s) => s.session_date >= d30).length;
    const prev30 = sessions.filter((s) => s.session_date >= d60 && s.session_date < d30).length;
    const delta = last30 - prev30;

    // Last 7 days, kids per day.
    const week = useMemo(() => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = TS.daysAgo(i);
        const rows = sessions.filter((s) => (s.session_date || '').slice(0, 10) === date);
        const vrows = vols.filter((v) => (v.log_date || '').slice(0, 10) === date);
        days.push({
          date,
          label: i === 0 ? 'Today' : TS.fmtDate(date),
          kids: rows.reduce((n, s) => n + (Number(s.participants) || 0), 0)
              + vrows.reduce((n, v) => n + (Number(v.people_helped) || 0), 0),
          count: rows.length,
        });
      }
      return days;
    }, [data.sessions, data.volunteerLogs, chapterFilter]);
    const weekMax = Math.max(1, ...week.map((d) => d.kids));
    const weekKids = week.reduce((n, d) => n + d.kids, 0);
    const weekCount = week.reduce((n, d) => n + d.count, 0);

    const pendingT = data.testimonials.filter((t) => !t.approved);
    const pendingP = data.photos.filter((p) => !p.approved);
    const noCode = data.coaches.filter((c) => c.active && c.name !== 'Coach TBD' && !c.access_code);
    const quiet = sessions.filter((s) => s.session_date >= TS.daysAgo(7)).length === 0 && sessions.length > 0;
    const attention = [
      ...pendingT.length ? [{ icon: 'quote', name: `${pendingT.length} testimonial${pendingT.length === 1 ? '' : 's'} waiting for review`, sub: 'Approve or decline before they go public', go: 'approvals' }] : [],
      ...pendingP.length ? [{ icon: 'camera', name: `${pendingP.length} photo${pendingP.length === 1 ? '' : 's'} pending approval`, sub: 'Uploaded by coaches', go: 'approvals' }] : [],
      ...noCode.length ? [{ icon: 'key', name: `${noCode.length} coach${noCode.length === 1 ? '' : 'es'} without an access code`, sub: 'They can’t log in to the coach portal yet', go: 'manage' }] : [],
      ...quiet ? [{ icon: 'alert', name: 'No sessions logged this week', sub: 'Nudge your coaches to log their sessions', go: 'sessions' }] : [],
    ];

    const byChapter = useMemo(() => {
      const counts = new Map();
      for (const s of data.sessions) {
        if (!s.chapter) continue;
        counts.set(s.chapter, (counts.get(s.chapter) || 0) + 1);
      }
      const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const max = Math.max(1, ...rows.map(([, n]) => n));
      return rows.map(([name, n], i) => ({ name, n, pct: Math.round((n / max) * 100), color: CHART_COLORS[i % CHART_COLORS.length] }));
    }, [data.sessions]);

    const recent = sessions.slice(0, 5);
    const photos = data.photos.filter((p) => p.approved).slice(0, 4);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const chapterName = chapterFilter != null ? data.chapters.find((c) => c.id === chapterFilter)?.name : null;

    return (
      <div className="view">
        <PageHead icon="sun" eyebrow={TS.fmtFull(TS.today())}
          title={`${greeting}.`}
          lede={chapterName
            ? `Here’s how the ${chapterName} chapter is doing.`
            : 'Here’s what’s happening across Together Sports right now.'}
          actions={<>
            <Btn icon="external" onClick={() => window.open('/impact.html', '_blank')}>Impact page</Btn>
            <Btn kind="primary" icon="calendar-plus" onClick={() => setView('add')}>Log a session</Btn>
          </>} />

        <section className="ts-stats">
          <div className="ts-stat ts-stat--hero">
            <span className="ts-stat-label">Total sessions</span>
            <span className="ts-stat-value">{sessions.length}</span>
            <div className="ts-stat-foot">
              {delta !== 0 && <span className="ts-stat-delta">{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</span>}
              <span className="ts-stat-sub">{last30} in the last 30 days</span>
            </div>
          </div>
          <div className="ts-stat">
            <span className="ts-stat-label">Kids reached</span>
            <span className="ts-stat-value">{kidsReached}</span>
            <div className="ts-stat-foot"><span className="ts-stat-sub">sessions + volunteer activities</span></div>
          </div>
          <div className="ts-stat">
            <span className="ts-stat-label">Volunteer hours</span>
            <span className="ts-stat-value">{Number.isInteger(volHours) ? volHours : volHours.toFixed(1)}</span>
            <div className="ts-stat-foot"><span className="ts-stat-sub">{vols.length} activit{vols.length === 1 ? 'y' : 'ies'} logged</span></div>
          </div>
          <div className="ts-stat">
            <span className="ts-stat-label">Active coaches</span>
            <span className="ts-stat-value">{activeCoaches}</span>
            <div className="ts-stat-foot"><span className="ts-stat-sub">{data.chapters.length} chapters worldwide</span></div>
          </div>
        </section>

        <div className="ts-grid">
          <div className="ts-col">
            <section className="ts-card ts-chart">
              <div className="ts-card-head">
                <div>
                  <h2 className="ts-card-title">This week</h2>
                  <p className="ts-card-sub">Kids reached per day, last 7 days</p>
                </div>
                <button className="ts-link" onClick={() => setView('sessions')}>All sessions <Ic name="arrow-right" size={13} /></button>
              </div>
              <div className="ts-bars">
                {week.map((d) => (
                  <div className="ts-barcol" key={d.date} title={`${d.count} session${d.count === 1 ? '' : 's'}`}>
                    <span className="ts-barval">{d.kids || ''}</span>
                    <div className="ts-barwrap">
                      <div className={`ts-bar${d.label === 'Today' ? ' is-cur' : ''}`}
                           style={{ height: `${Math.max(4, Math.round((d.kids / weekMax) * 100))}%` }} />
                    </div>
                    <span className="ts-barlab">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="ts-weekrow">
                <span className="ts-week-label">Week total</span>
                <span className="ts-week-meta"><strong>{weekKids}</strong> kids · <strong>{weekCount}</strong> sessions</span>
              </div>
            </section>

            <section className="ts-card ts-sessions">
              <div className="ts-card-head">
                <div>
                  <h2 className="ts-card-title">Recent sessions</h2>
                  <p className="ts-card-sub">The latest activity from your coaches</p>
                </div>
                <button className="ts-link" onClick={() => setView('sessions')}>View all <Ic name="arrow-right" size={13} /></button>
              </div>
              <div className="ts-table ts-table--ov">
                <div className="ts-tr ts-tr--head">
                  <span>Date</span><span>Coach</span><span>Sport</span><span>Location</span><span style={{ textAlign: 'right' }}>Kids</span>
                </div>
                {recent.length === 0 && (
                  <div className="ts-table-empty">
                    <Empty icon="calendar" title="No sessions yet"
                           body="Log your first session and it will show up here."
                           action={<Btn kind="primary" sm icon="plus" onClick={() => setView('add')}>Log a session</Btn>} />
                  </div>
                )}
                {recent.map((s) => (
                  <div className="ts-tr" key={s.id} onClick={() => setView('sessions', { sessionId: s.id })} style={{ cursor: 'pointer' }}>
                    <span className="ts-td-date">{TS.fmtDate(s.session_date)}<span className="ts-td-year">{TS.fmtYear(s.session_date)}</span></span>
                    <span className="ts-coach"><Avatar name={s.coach} size={28} />{s.coach || '—'}</span>
                    <span><SportTag name={s.sport} sm /></span>
                    <span className="ts-td-loc"><span className="ts-pin"><Ic name="pin" size={12} /></span>{s.location || s.chapter || '—'}</span>
                    <span className="ts-kids ts-num">{s.participants || 0}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="ts-side">
            <section className="ts-card ts-attn">
              <div className="ts-card-head">
                <div>
                  <h2 className="ts-card-title">Needs attention</h2>
                  <p className="ts-card-sub">Things waiting on you</p>
                </div>
                {attention.length > 0 && <span className="ts-countchip">{attention.length}</span>}
              </div>
              {attention.length === 0
                ? <div className="ts-allclear"><Ic name="badge-check" size={17} /> All clear — nothing waiting on you.</div>
                : attention.map((a, i) => (
                  <div className="ts-attn-row" key={i}>
                    <span className="ts-attn-ic"><Ic name={a.icon} size={15.5} /></span>
                    <div className="ts-attn-main">
                      <div className="ts-attn-name">{a.name}</div>
                      <div className="ts-attn-sub">{a.sub}</div>
                    </div>
                    <button className="ts-link" onClick={() => setView(a.go)}>Review <Ic name="chev-right" size={13} /></button>
                  </div>
                ))}
            </section>

            <section className="ts-card ts-photos">
              <div className="ts-card-head">
                <div>
                  <h2 className="ts-card-title">Latest photos</h2>
                  <p className="ts-card-sub">From sessions in the field</p>
                </div>
                <button className="ts-link" onClick={() => setView('gallery')}>Gallery <Ic name="arrow-right" size={13} /></button>
              </div>
              {photos.length === 0
                ? <Empty icon="camera" title="No photos yet" body="Photos uploaded by you or your coaches will appear here." />
                : <div className="ts-photogrid">
                    {photos.map((p) => (
                      <div className="ui-photo" key={p.id} style={{ aspectRatio: '4 / 3' }}>
                        <img src={p.url} alt={p.caption || 'Session photo'} loading="lazy" />
                        {p.chapter && <span className="ui-photo-tag">{p.chapter}</span>}
                      </div>
                    ))}
                  </div>}
            </section>

            <section className="ts-card ts-chapters">
              <div className="ts-card-head">
                <div>
                  <h2 className="ts-card-title">Chapters</h2>
                  <p className="ts-card-sub">Sessions logged, all time</p>
                </div>
              </div>
              {byChapter.length === 0
                ? <Empty icon="globe" title="No chapter activity" body="Once sessions are logged they’ll be tallied by chapter." />
                : <div className="ts-chlist">
                    {byChapter.map((c) => (
                      <div className="ts-chrow" key={c.name}>
                        <span className="ts-chname">{TS.flag(c.name)} {c.name}</span>
                        <div className="ts-chtrack"><div className="ts-chfill" style={{ width: `${c.pct}%`, background: c.color }} /></div>
                        <span className="ts-chn">{c.n}</span>
                      </div>
                    ))}
                  </div>}
            </section>
          </div>
        </div>
      </div>
    );
  };

  TS.views.overview = Overview;
})();
