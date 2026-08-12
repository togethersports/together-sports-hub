/* view_roster.jsx — coach roster cards + profile modal. */

(() => {
  const TS = window.TS;
  const { useState, useMemo } = React;
  const { Ic, Btn, PageHead, SportTag, Avatar, Status, Select, Seg, Modal, Empty, useToast } = TS.ui;

  const CoachProfile = ({ coach, data, onClose, onEdit, setView }) => {
    const toast = useToast();
    const sessions = data.sessions.filter((s) => s.coach_id === coach.id);
    const vols = data.volunteerLogs.filter((v) => v.coach_id === coach.id);
    const kids = sessions.reduce((n, s) => n + (Number(s.participants) || 0), 0)
               + vols.reduce((n, v) => n + (Number(v.people_helped) || 0), 0);
    const volHours = vols.reduce((n, v) => n + (Number(v.hours) || 0), 0);

    const copyCode = () => {
      navigator.clipboard?.writeText(coach.access_code)
        .then(() => toast('Access code copied'))
        .catch(() => toast('Couldn’t copy — select it manually', { error: true }));
    };

    return (
      <Modal title={coach.name} sub={[coach.chapter, coach.sport].filter(Boolean).join(' · ') || 'No chapter assigned'}
             onClose={onClose}
        foot={<>
          <Btn onClick={() => { onClose(); setView('sessions'); }}>View sessions</Btn>
          <Btn kind="primary" icon="edit" onClick={onEdit}>Edit coach</Btn>
        </>}>
        <div className="ts-profile">
          <div className="ts-profile-head">
            <Avatar name={coach.name} size={62} />
            <div>
              <div className="ts-profile-sports"><SportTag name={coach.sport} sm /></div>
              <Status on={!!coach.active} />
            </div>
          </div>
          <div className="ts-profile-rows">
            {coach.email && <div className="ts-profile-row"><Ic name="mail" size={15} /><a href={`mailto:${coach.email}`}>{coach.email}</a></div>}
            {coach.phone && <div className="ts-profile-row"><Ic name="phone" size={15} /><a href={`tel:${coach.phone}`}>{coach.phone}</a></div>}
            {coach.chapter && <div className="ts-profile-row"><Ic name="pin" size={15} />{TS.flag(coach.chapter)} {coach.chapter}</div>}
            <div className="ts-profile-row">
              <Ic name="key" size={15} />
              {coach.access_code
                ? <span className="ts-code"><span className="ts-mono">{coach.access_code}</span>
                    <button onClick={copyCode} title="Copy access code"><Ic name="copy" size={13} /></button></span>
                : <span className="ts-muted-line">No portal access code yet</span>}
            </div>
          </div>
          {coach.bio && <p className="ts-muted-line" style={{ lineHeight: 1.6 }}>{coach.bio}</p>}
          <div className="ts-profile-sessions">
            <div className="ts-profile-label">
              Impact — {sessions.length} session{sessions.length === 1 ? '' : 's'} · {kids} kids · {TS.fmtHours(volHours)} volunteered
            </div>
            {sessions.length === 0 && <span className="ts-muted-line">No sessions logged yet.</span>}
            {sessions.slice(0, 5).map((s) => (
              <div className="ts-profile-srow" key={s.id}>
                <span className="ts-td-date">{TS.fmtDate(s.session_date)}</span>
                <SportTag name={s.sport} sm />
                <span className="ts-profile-loc">{s.location || s.chapter || ''}</span>
                <span className="ts-kids">{s.participants || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  };

  const Roster = ({ data, reload, setView, param, chapterFilter }) => {
    const [q, setQ] = useState('');
    const [fChapter, setFChapter] = useState('');
    const [fSport, setFSport] = useState('');
    const [fStatus, setFStatus] = useState('active');
    const [openId, setOpenId] = useState(param?.coachId ?? null);
    const [editing, setEditing] = useState(null);

    const coaches = useMemo(() => {
      let list = data.coaches.filter((c) => c.name !== 'Coach TBD');
      if (chapterFilter != null) list = list.filter((c) => c.chapter_id === chapterFilter);
      if (fChapter) list = list.filter((c) => String(c.chapter_id) === fChapter);
      if (fSport) list = list.filter((c) => String(c.sport_id) === fSport);
      if (fStatus === 'active') list = list.filter((c) => c.active);
      if (fStatus === 'inactive') list = list.filter((c) => !c.active);
      const needle = q.trim().toLowerCase();
      if (needle) list = list.filter((c) => [c.name, c.email, c.chapter, c.sport].some((v) => (v || '').toLowerCase().includes(needle)));
      return list;
    }, [data.coaches, q, fChapter, fSport, fStatus, chapterFilter]);

    const statsFor = (c) => {
      const ss = data.sessions.filter((s) => s.coach_id === c.id);
      const vv = data.volunteerLogs.filter((v) => v.coach_id === c.id);
      return {
        sessions: ss.length,
        kids: ss.reduce((n, s) => n + (Number(s.participants) || 0), 0)
            + vv.reduce((n, v) => n + (Number(v.people_helped) || 0), 0),
        last: ss[0]?.session_date,
      };
    };

    const open = openId != null ? data.coaches.find((c) => c.id === openId) : null;
    const CoachFormModal = TS.CoachFormModal;

    return (
      <div className="view">
        <PageHead icon="whistle" eyebrow="People" title="Coaches"
          lede="The volunteers running sessions in every chapter."
          actions={<Btn kind="primary" icon="plus" onClick={() => setEditing({})}>Add coach</Btn>} />

        <div className="ts-filterbar">
          <div className="ts-filterbar-search">
            <Ic name="search" size={15} />
            <input value={q} placeholder="Search coaches…" onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ts-filter-field">
            <Select value={fChapter} onChange={(e) => setFChapter(e.target.value)}>
              <option value="">All chapters</option>
              {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="ts-filter-field">
            <Select value={fSport} onChange={(e) => setFSport(e.target.value)}>
              <option value="">All sports</option>
              {data.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <Seg value={fStatus} onChange={setFStatus}
               options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <span className="ts-filter-meta"><strong>{coaches.length}</strong> coaches</span>
        </div>

        {coaches.length === 0
          ? <section className="ts-card" style={{ padding: 30 }}>
              <Empty icon="whistle" title="No coaches match"
                     body="Try different filters, or add a new coach to the roster."
                     action={<Btn kind="primary" sm icon="plus" onClick={() => setEditing({})}>Add coach</Btn>} />
            </section>
          : <div className="ts-roster">
              {coaches.map((c) => {
                const st = statsFor(c);
                return (
                  <button className="ts-coachcard" key={c.id} onClick={() => setOpenId(c.id)} style={{ textAlign: 'left', font: 'inherit' }}>
                    <div className="ts-coachcard-top">
                      <Avatar name={c.name} size={46} />
                      <div className="ts-coachcard-id">
                        <div className="ts-coachcard-name">{c.name}</div>
                        <div className="ts-coachcard-chap">
                          <Ic name="pin" size={12} />{c.chapter || 'No chapter'}
                          {!c.active && <> · <Status on={false} /></>}
                        </div>
                      </div>
                    </div>
                    <div className="ts-coachcard-sports">
                      <SportTag name={c.sport} sm />
                      {!c.access_code && <span className="ui-tag ui-tag--sm" style={{ background: 'var(--peach-soft)', color: '#8A4A12' }}>No portal code</span>}
                    </div>
                    <div className="ts-coachcard-foot">
                      <span><strong>{st.sessions}</strong> session{st.sessions === 1 ? '' : 's'} · <strong>{st.kids}</strong> kids</span>
                      <span className="ts-coachcard-since">{st.last ? `Last: ${TS.fmtDate(st.last)}` : 'No sessions yet'}</span>
                    </div>
                  </button>
                );
              })}
            </div>}

        {open && (
          <CoachProfile coach={open} data={data} setView={setView}
                        onClose={() => setOpenId(null)}
                        onEdit={() => { setEditing(open); setOpenId(null); }} />
        )}
        {editing && CoachFormModal && (
          <CoachFormModal coach={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />
        )}
      </div>
    );
  };

  TS.views.roster = Roster;
})();
