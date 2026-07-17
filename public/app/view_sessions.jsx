/* view_sessions.jsx — all sessions: filter, sort, detail drawer, edit, delete, CSV. */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useMemo } = React;
  const { Ic, Btn, IconBtn, PageHead, SportTag, Avatar, Field, Input, Select, Textarea, Stepper,
          Modal, Drawer, Confirm, Empty, Loading, SortHead, useToast } = TS.ui;

  const EditSessionModal = ({ session, data, onClose, onSaved }) => {
    const toast = useToast();
    const [f, setF] = useState({
      session_date: session.session_date || '', chapter_id: session.chapter_id || '',
      sport_id: session.sport_id || '', participants: session.participants ?? '',
      duration_minutes: session.duration_minutes ?? '', location: session.location || '',
      notes: session.notes || '',
    });
    const [busy, setBusy] = useState(false);
    const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
      if (!f.session_date) { toast('A session date is required', { error: true }); return; }
      setBusy(true);
      try {
        await TS.api(`/api/sessions/${session.id}`, { method: 'PUT', body: {
          coach_id: session.coach_id, session_date: f.session_date,
          chapter_id: f.chapter_id || null, sport_id: f.sport_id || null,
          participants: f.participants === '' ? null : Number(f.participants),
          duration_minutes: f.duration_minutes === '' ? null : Number(f.duration_minutes),
          location: f.location || null, notes: f.notes || null,
        }});
        toast('Session updated');
        onSaved();
        onClose();
      } catch (e) {
        toast(e.message, { error: true });
      } finally { setBusy(false); }
    };

    return (
      <Modal title="Edit session" sub={session.coach ? `Logged by ${session.coach}` : undefined} wide onClose={onClose}
        foot={<>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Btn>
        </>}>
        <div className="ts-form-grid">
          <Field label="Date" req>
            <Input type="date" value={f.session_date} onChange={(e) => set('session_date')(e.target.value)} />
          </Field>
          <Field label="Chapter">
            <Select value={f.chapter_id} onChange={(e) => set('chapter_id')(e.target.value)}>
              <option value="">No chapter</option>
              {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Sport">
            <Select value={f.sport_id} onChange={(e) => set('sport_id')(e.target.value)}>
              <option value="">No sport</option>
              {data.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Kids attending">
            <Stepper value={f.participants} onChange={set('participants')} />
          </Field>
          <Field label="Duration (minutes)">
            <Stepper value={f.duration_minutes} onChange={set('duration_minutes')} step={15} max={600} />
          </Field>
          <Field label="Location">
            <Input value={f.location} placeholder="e.g. McCarren Park courts" onChange={(e) => set('location')(e.target.value)} />
          </Field>
          <Field label="Notes" className="ts-form-full">
            <Textarea rows={3} value={f.notes} placeholder="Anything worth remembering about this session…"
                      onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
      </Modal>
    );
  };
  TS.EditSessionModal = EditSessionModal;

  const SessionDrawer = ({ session, onClose, onEdit, onDelete }) => {
    const [parts, setParts] = useState(null);
    useEffect(() => {
      let live = true;
      TS.api(`/api/participants?session_id=${session.id}`)
        .then((rows) => { if (live) setParts(rows); })
        .catch(() => { if (live) setParts([]); });
      return () => { live = false; };
    }, [session.id]);

    return (
      <Drawer title={`${session.sport || 'Session'} · ${TS.fmtDate(session.session_date)}`}
              sub={session.chapter || undefined} onClose={onClose}
        foot={<>
          <Btn icon="trash" onClick={onDelete}>Delete</Btn>
          <Btn kind="primary" icon="edit" onClick={onEdit}>Edit session</Btn>
        </>}>
        <div className="ts-dwr">
          <div className="ts-dwr-hero">
            <div className="ts-dwr-kids">{session.participants || 0}<span>kids attended</span></div>
            <SportTag name={session.sport} />
          </div>
          <div className="ts-dwr-rows">
            <div className="ts-dwr-row"><Ic name="calendar" size={15} />{TS.fmtFull(session.session_date)}</div>
            <div className="ts-dwr-row"><Ic name="pin" size={15} />{session.location || session.chapter || 'No location recorded'}</div>
            <div className="ts-dwr-row"><Ic name="clock" size={15} />{TS.fmtDuration(session.duration_minutes)}</div>
            {session.submitted_by && <div className="ts-dwr-row"><Ic name="edit" size={15} />Submitted by {session.submitted_by}</div>}
          </div>
          {session.coach && (
            <div className="ts-dwr-coach">
              <Avatar name={session.coach} size={44} />
              <div className="ts-dwr-coachmeta">
                <span className="ts-dwr-coachname">{session.coach}</span>
                <span>Coach{session.chapter ? ` · ${session.chapter}` : ''}</span>
              </div>
            </div>
          )}
          {session.notes && <div className="ts-dwr-notes">“{session.notes}”</div>}
          <div className="ts-dwr-parts">
            <div className="ts-profile-label">Participants ({parts ? parts.length : '…'})</div>
            {parts === null && <Loading label="Loading participants…" />}
            {parts && parts.length === 0 && <span className="ts-muted-line">No participant contact info was logged for this session.</span>}
            {parts && parts.map((p) => (
              <div className="ts-dwr-part" key={p.id}>
                <Avatar name={p.name} size={28} />
                <b>{p.name}</b>
                <span>{[p.parent_name, p.parent_contact].filter(Boolean).join(' · ') || 'no contact info'}</span>
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    );
  };

  const Sessions = ({ data, reload, setView, param, chapterFilter }) => {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [fChapter, setFChapter] = useState('');
    const [fSport, setFSport] = useState('');
    const [fCoach, setFCoach] = useState('');
    const [sort, setSort] = useState({ col: 'date', dir: 'desc' });
    const [openId, setOpenId] = useState(param?.sessionId ?? null);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const rows = useMemo(() => {
      let list = data.sessions;
      if (chapterFilter != null) list = list.filter((s) => s.chapter_id === chapterFilter);
      if (fChapter) list = list.filter((s) => String(s.chapter_id) === fChapter);
      if (fSport) list = list.filter((s) => String(s.sport_id) === fSport);
      if (fCoach) list = list.filter((s) => String(s.coach_id) === fCoach);
      const needle = q.trim().toLowerCase();
      if (needle) {
        list = list.filter((s) =>
          [s.coach, s.location, s.notes, s.chapter, s.sport].some((v) => (v || '').toLowerCase().includes(needle)));
      }
      const dir = sort.dir === 'desc' ? -1 : 1;
      const key = {
        date: (s) => s.session_date || '',
        coach: (s) => s.coach || '',
        kids: (s) => Number(s.participants) || 0,
        duration: (s) => Number(s.duration_minutes) || 0,
      }[sort.col];
      return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
    }, [data.sessions, q, fChapter, fSport, fCoach, sort, chapterFilter]);

    const totalKids = rows.reduce((n, s) => n + (Number(s.participants) || 0), 0);
    const hasFilters = q || fChapter || fSport || fCoach;
    const open = openId != null ? data.sessions.find((s) => s.id === openId) : null;

    const exportCsv = () => {
      TS.exportCsv('sessions.csv',
        ['Date', 'Coach', 'Chapter', 'Sport', 'Kids', 'Duration (min)', 'Location', 'Notes'],
        rows.map((s) => [s.session_date, s.coach, s.chapter, s.sport, s.participants, s.duration_minutes, s.location, s.notes]));
      toast(`Exported ${rows.length} session${rows.length === 1 ? '' : 's'}`);
    };

    const doDelete = async (s) => {
      try {
        await TS.api(`/api/sessions/${s.id}`, { method: 'DELETE' });
        toast('Session deleted');
        if (openId === s.id) setOpenId(null);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="calendar" eyebrow="Program" title="Sessions"
          lede="Every session logged by you and your coaches, across all chapters."
          actions={<>
            <Btn icon="download" onClick={exportCsv}>Export CSV</Btn>
            <Btn kind="primary" icon="calendar-plus" onClick={() => setView('add')}>Log a session</Btn>
          </>} />

        <div className="ts-filterbar">
          <div className="ts-filterbar-search">
            <Ic name="search" size={15} />
            <input value={q} placeholder="Search coach, location, notes…" onChange={(e) => setQ(e.target.value)} />
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
          <div className="ts-filter-field">
            <Select value={fCoach} onChange={(e) => setFCoach(e.target.value)}>
              <option value="">All coaches</option>
              {data.coaches.filter((c) => c.name !== 'Coach TBD').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <button className="ts-clear" onClick={() => { setQ(''); setFChapter(''); setFSport(''); setFCoach(''); }}>
              <Ic name="x" size={13} /> Clear
            </button>
          )}
          <span className="ts-filter-meta"><strong>{rows.length}</strong> sessions · <strong>{totalKids}</strong> kids</span>
        </div>

        <section className="ts-card ts-tablecard">
          <div className="ts-table ts-table--full">
            <div className="ts-tr ts-tr--full ts-tr--head">
              <SortHead label="Date" col="date" sort={sort} setSort={setSort} />
              <SortHead label="Coach" col="coach" sort={sort} setSort={setSort} />
              <span>Chapter</span>
              <span>Location</span>
              <span>Sport</span>
              <SortHead label="Kids" col="kids" sort={sort} setSort={setSort} num />
              <SortHead label="Time" col="duration" sort={sort} setSort={setSort} num />
              <span />
            </div>
            {rows.length === 0 && (
              <div className="ts-table-empty">
                <Empty icon="calendar" title={hasFilters ? 'Nothing matches those filters' : 'No sessions yet'}
                       body={hasFilters ? 'Try widening your search.' : 'Log your first session to start building your impact record.'}
                       action={!hasFilters && <Btn kind="primary" sm icon="plus" onClick={() => setView('add')}>Log a session</Btn>} />
              </div>
            )}
            {rows.map((s) => (
              <div className="ts-tr ts-tr--full ts-tr--click" key={s.id} onClick={() => setOpenId(s.id)}>
                <span className="ts-td-date">{TS.fmtDate(s.session_date)}<span className="ts-td-year">{TS.fmtYear(s.session_date)}</span></span>
                <span className="ts-coach"><Avatar name={s.coach} size={28} /><span>{s.coach || '—'}</span></span>
                <span className="ts-td-loc">{s.chapter ? `${TS.flag(s.chapter)} ${s.chapter}` : '—'}</span>
                <span className="ts-td-loc">{s.location || '—'}</span>
                <span className="ts-cell-sports"><SportTag name={s.sport} sm /></span>
                <span className="ts-kids ts-num">{s.participants || 0}</span>
                <span className="ts-num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{TS.fmtDuration(s.duration_minutes)}</span>
                <span className="ts-rowactions" onClick={(e) => e.stopPropagation()}>
                  <span className="ts-rowghost"><IconBtn icon="edit" title="Edit" onClick={() => setEditing(s)} /></span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {open && (
          <SessionDrawer session={open} onClose={() => setOpenId(null)}
            onEdit={() => setEditing(open)}
            onDelete={() => setDeleting(open)} />
        )}
        {editing && (
          <EditSessionModal session={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />
        )}
        {deleting && (
          <Confirm title="Delete this session?"
            body={`This removes the ${deleting.sport || ''} session on ${TS.fmtFull(deleting.session_date)}${deleting.coach ? ` logged by ${deleting.coach}` : ''}. This can’t be undone.`}
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.sessions = Sessions;
})();
