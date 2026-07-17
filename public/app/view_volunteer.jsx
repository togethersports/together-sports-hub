/* view_volunteer.jsx — volunteer activity logs: filter, edit, delete, CSV. */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useMemo } = React;
  const { Ic, Btn, IconBtn, PageHead, Avatar, Tag, Field, Input, Select, Textarea, Stepper,
          Modal, Drawer, Confirm, Empty, Loading, SortHead, useToast } = TS.ui;

  const EditLogModal = ({ log, data, onClose, onSaved }) => {
    const toast = useToast();
    const isNew = !log.id;
    const [f, setF] = useState({
      coach_id: log.coach_id || '', log_date: log.log_date || TS.today(),
      activity_type: log.activity_type || '', description: log.description || '',
      people_helped: log.people_helped ?? '', hours: log.hours ?? '',
      chapter_id: log.chapter_id || '',
    });
    const [busy, setBusy] = useState(false);
    const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
      if (!f.log_date || !f.activity_type) { toast('Date and activity type are required', { error: true }); return; }
      setBusy(true);
      try {
        const body = {
          coach_id: f.coach_id || null, log_date: f.log_date, activity_type: f.activity_type,
          description: f.description || null,
          people_helped: f.people_helped === '' ? 0 : Number(f.people_helped),
          hours: f.hours === '' ? 0 : Number(f.hours),
          chapter_id: f.chapter_id || null,
        };
        if (isNew) await TS.api('/api/volunteer-logs', { method: 'POST', body });
        else await TS.api(`/api/volunteer-logs/${log.id}`, { method: 'PUT', body });
        toast(isNew ? 'Activity logged' : 'Activity updated');
        onSaved();
        onClose();
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <Modal title={isNew ? 'Log volunteer activity' : 'Edit volunteer activity'} wide onClose={onClose}
        foot={<>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : isNew ? 'Log activity' : 'Save changes'}</Btn>
        </>}>
        <div className="ts-form-grid">
          <Field label="Date" req>
            <Input type="date" value={f.log_date} onChange={(e) => set('log_date')(e.target.value)} />
          </Field>
          <Field label="Activity type" req>
            <Select value={f.activity_type} onChange={(e) => set('activity_type')(e.target.value)}>
              <option value="">Select type…</option>
              {TS.ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Volunteer">
            <Select value={f.coach_id} onChange={(e) => set('coach_id')(e.target.value)} disabled={!isNew}>
              <option value="">{isNew ? 'Select coach…' : log.coach || 'Unassigned'}</option>
              {isNew && data.coaches.filter((c) => c.name !== 'Coach TBD').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Chapter">
            <Select value={f.chapter_id} onChange={(e) => set('chapter_id')(e.target.value)}>
              <option value="">No chapter</option>
              {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="People helped">
            <Stepper value={f.people_helped} onChange={set('people_helped')} />
          </Field>
          <Field label="Hours">
            <Input type="number" min="0" step="0.5" value={f.hours} placeholder="e.g. 2.5"
                   onChange={(e) => set('hours')(e.target.value)} />
          </Field>
          <Field label="Description" className="ts-form-full">
            <Textarea rows={3} value={f.description} placeholder="What happened during this activity?"
                      onChange={(e) => set('description')(e.target.value)} />
          </Field>
        </div>
      </Modal>
    );
  };

  const LogDrawer = ({ log, onClose, onEdit, onDelete }) => {
    const [parts, setParts] = useState(null);
    useEffect(() => {
      let live = true;
      TS.api(`/api/participants?volunteer_log_id=${log.id}`)
        .then((rows) => { if (live) setParts(rows); })
        .catch(() => { if (live) setParts([]); });
      return () => { live = false; };
    }, [log.id]);

    return (
      <Drawer title={log.activity_type} sub={TS.fmtFull(log.log_date)} onClose={onClose}
        foot={<>
          <Btn icon="trash" onClick={onDelete}>Delete</Btn>
          <Btn kind="primary" icon="edit" onClick={onEdit}>Edit activity</Btn>
        </>}>
        <div className="ts-dwr">
          <div className="ts-dwr-hero">
            <div className="ts-dwr-kids">{log.people_helped || 0}<span>people helped</span></div>
            <div className="ts-dwr-kids">{TS.fmtHours(log.hours)}<span>volunteered</span></div>
          </div>
          <div className="ts-dwr-rows">
            <div className="ts-dwr-row"><Ic name={TS.ACTIVITY_ICONS[log.activity_type] || 'sparkle'} size={15} />{log.activity_type}</div>
            <div className="ts-dwr-row"><Ic name="calendar" size={15} />{TS.fmtFull(log.log_date)}</div>
            {log.chapter && <div className="ts-dwr-row"><Ic name="pin" size={15} />{log.chapter}</div>}
          </div>
          {log.coach && (
            <div className="ts-dwr-coach">
              <Avatar name={log.coach} size={44} />
              <div className="ts-dwr-coachmeta">
                <span className="ts-dwr-coachname">{log.coach}</span>
                <span>Volunteer{log.chapter ? ` · ${log.chapter}` : ''}</span>
              </div>
            </div>
          )}
          {log.description && <div className="ts-dwr-notes">“{log.description}”</div>}
          <div className="ts-dwr-parts">
            <div className="ts-profile-label">People logged ({parts ? parts.length : '…'})</div>
            {parts === null && <Loading label="Loading…" />}
            {parts && parts.length === 0 && <span className="ts-muted-line">No individual contact info was logged for this activity.</span>}
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

  const Volunteer = ({ data, reload, chapterFilter }) => {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [fType, setFType] = useState('');
    const [fCoach, setFCoach] = useState('');
    const [sort, setSort] = useState({ col: 'date', dir: 'desc' });
    const [openId, setOpenId] = useState(null);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const rows = useMemo(() => {
      let list = data.volunteerLogs;
      if (chapterFilter != null) list = list.filter((v) => v.chapter_id === chapterFilter);
      if (fType) list = list.filter((v) => v.activity_type === fType);
      if (fCoach) list = list.filter((v) => String(v.coach_id) === fCoach);
      const needle = q.trim().toLowerCase();
      if (needle) {
        list = list.filter((v) =>
          [v.coach, v.description, v.activity_type, v.chapter].some((x) => (x || '').toLowerCase().includes(needle)));
      }
      const dir = sort.dir === 'desc' ? -1 : 1;
      const key = {
        date: (v) => v.log_date || '',
        coach: (v) => v.coach || '',
        people: (v) => Number(v.people_helped) || 0,
        hours: (v) => Number(v.hours) || 0,
      }[sort.col];
      return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
    }, [data.volunteerLogs, q, fType, fCoach, sort, chapterFilter]);

    const totalHours = rows.reduce((n, v) => n + (Number(v.hours) || 0), 0);
    const totalPeople = rows.reduce((n, v) => n + (Number(v.people_helped) || 0), 0);
    const hasFilters = q || fType || fCoach;
    const open = openId != null ? data.volunteerLogs.find((v) => v.id === openId) : null;

    const exportCsv = () => {
      TS.exportCsv('volunteer-logs.csv',
        ['Date', 'Coach', 'Activity', 'People helped', 'Hours', 'Chapter', 'Description'],
        rows.map((v) => [v.log_date, v.coach, v.activity_type, v.people_helped, v.hours, v.chapter, v.description]));
      toast(`Exported ${rows.length} log${rows.length === 1 ? '' : 's'}`);
    };

    const doDelete = async (v) => {
      try {
        await TS.api(`/api/volunteer-logs/${v.id}`, { method: 'DELETE' });
        toast('Activity deleted');
        if (openId === v.id) setOpenId(null);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="heart" eyebrow="Program" title="Volunteer logs"
          lede="Hours and outreach beyond coaching sessions — mentoring, events, fundraising and more."
          actions={<>
            <Btn icon="download" onClick={exportCsv}>Export CSV</Btn>
            <Btn kind="primary" icon="plus" onClick={() => setEditing({})}>Log activity</Btn>
          </>} />

        <div className="ts-filterbar">
          <div className="ts-filterbar-search">
            <Ic name="search" size={15} />
            <input value={q} placeholder="Search coach, description…" onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ts-filter-field">
            <Select value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">All activity types</option>
              {TS.ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div className="ts-filter-field">
            <Select value={fCoach} onChange={(e) => setFCoach(e.target.value)}>
              <option value="">All coaches</option>
              {data.coaches.filter((c) => c.name !== 'Coach TBD').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <button className="ts-clear" onClick={() => { setQ(''); setFType(''); setFCoach(''); }}>
              <Ic name="x" size={13} /> Clear
            </button>
          )}
          <span className="ts-filter-meta">
            <strong>{rows.length}</strong> logs · <strong>{Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}</strong>h · <strong>{totalPeople}</strong> people
          </span>
        </div>

        <section className="ts-card ts-tablecard">
          <div className="ts-table ts-table--vol">
            <div className="ts-tr ts-tr--vol ts-tr--head">
              <SortHead label="Date" col="date" sort={sort} setSort={setSort} />
              <SortHead label="Coach" col="coach" sort={sort} setSort={setSort} />
              <span>Activity</span>
              <span>Description</span>
              <SortHead label="People" col="people" sort={sort} setSort={setSort} num />
              <SortHead label="Hours" col="hours" sort={sort} setSort={setSort} num />
              <span />
            </div>
            {rows.length === 0 && (
              <div className="ts-table-empty">
                <Empty icon="heart" title={hasFilters ? 'Nothing matches those filters' : 'No volunteer activity yet'}
                       body={hasFilters ? 'Try widening your search.' : 'Coaches log this from their portal, or you can add one here.'}
                       action={!hasFilters && <Btn kind="primary" sm icon="plus" onClick={() => setEditing({})}>Log activity</Btn>} />
              </div>
            )}
            {rows.map((v) => (
              <div className="ts-tr ts-tr--vol ts-tr--click" key={v.id} onClick={() => setOpenId(v.id)}>
                <span className="ts-td-date">{TS.fmtDate(v.log_date)}<span className="ts-td-year">{TS.fmtYear(v.log_date)}</span></span>
                <span className="ts-coach"><Avatar name={v.coach} size={28} /><span>{v.coach || '—'}</span></span>
                <span><Tag sm bg="var(--accent-soft)" fg="var(--accent-deep)">{v.activity_type}</Tag></span>
                <span className="ts-td-loc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description || '—'}</span>
                <span className="ts-kids ts-num">{v.people_helped || 0}</span>
                <span className="ts-num" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{TS.fmtHours(v.hours)}</span>
                <span className="ts-rowactions" onClick={(e) => e.stopPropagation()}>
                  <span className="ts-rowghost"><IconBtn icon="edit" title="Edit" onClick={() => setEditing(v)} /></span>
                  <span className="ts-rowghost"><IconBtn icon="trash" danger title="Delete" onClick={() => setDeleting(v)} /></span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {open && (
          <LogDrawer log={open} onClose={() => setOpenId(null)}
                     onEdit={() => setEditing(open)} onDelete={() => setDeleting(open)} />
        )}
        {editing && (
          <EditLogModal log={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />
        )}
        {deleting && (
          <Confirm title="Delete this activity?"
            body={`This removes the ${deleting.activity_type} log from ${TS.fmtFull(deleting.log_date)}${deleting.coach ? ` by ${deleting.coach}` : ''}. This can’t be undone.`}
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.volunteer = Volunteer;
})();
