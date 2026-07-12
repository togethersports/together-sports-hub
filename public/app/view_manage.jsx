/* view_manage.jsx — coach administration: table, form modal, access codes,
   chapters & sports. */

(() => {
  const TS = window.TS;
  const { useState, useMemo } = React;
  const { Ic, Btn, IconBtn, PageHead, SportTag, Avatar, Field, Input, Select, Textarea,
          Toggle, Seg, Modal, Confirm, Empty, useToast } = TS.ui;

  const CoachFormModal = ({ coach, data, onClose, onSaved }) => {
    const toast = useToast();
    const isNew = !coach.id;
    const [f, setF] = useState({
      name: coach.name || '', email: coach.email || '', phone: coach.phone || '',
      chapter_id: coach.chapter_id || '', sport_id: coach.sport_id || '',
      bio: coach.bio || '', access_code: coach.access_code || '',
      active: coach.active ?? 1,
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
      if (!f.name.trim()) { setErr('A name is required'); return; }
      setBusy(true);
      try {
        const body = {
          name: f.name.trim(), email: f.email || null, phone: f.phone || null,
          chapter_id: f.chapter_id || null, sport_id: f.sport_id || null,
          bio: f.bio || null, access_code: f.access_code.trim() || null,
          active: f.active ? 1 : 0,
        };
        if (isNew) {
          // POST only accepts the basics; set code/active with a follow-up PUT.
          const r = await TS.api('/api/coaches', { method: 'POST', body });
          if (body.access_code || !body.active) {
            await TS.api(`/api/coaches/${r.id}`, { method: 'PUT', body });
          }
        } else {
          await TS.api(`/api/coaches/${coach.id}`, { method: 'PUT', body });
        }
        toast(isNew ? `${f.name.trim()} added to the roster` : 'Coach updated');
        onSaved();
        onClose();
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <Modal title={isNew ? 'Add a coach' : `Edit ${coach.name}`}
             sub="Coaches sign in to the coach portal with their access code." wide onClose={onClose}
        foot={<>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add coach' : 'Save changes'}</Btn>
        </>}>
        <div className="ts-form-grid ts-coachform">
          <Field label="Full name" req error={err}>
            <Input value={f.name} invalid={!!err} autoFocus={isNew} placeholder="e.g. Jamie Rivera"
                   onChange={(e) => { set('name')(e.target.value); setErr(''); }} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} placeholder="coach@togethersports.org" onChange={(e) => set('email')(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} placeholder="(555) 555-5555" onChange={(e) => set('phone')(e.target.value)} />
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
          <Field label="Portal access code" hint="What the coach types to open the coach portal.">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={f.access_code} placeholder="e.g. TENNIS7" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}
                     onChange={(e) => set('access_code')(e.target.value.toUpperCase())} />
              <Btn sm type="button" icon="key" onClick={() => set('access_code')(TS.genAccessCode())}>Generate</Btn>
            </div>
          </Field>
          <Field label="Bio" className="ts-form-full">
            <Textarea rows={2} value={f.bio} placeholder="A line or two about this coach…" onChange={(e) => set('bio')(e.target.value)} />
          </Field>
          <div className="ts-statustoggle ts-form-full">
            <Toggle on={!!f.active} onChange={(v) => set('active')(v ? 1 : 0)} label="Active" />
            {f.active ? 'Active — can log in and appears in rosters' : 'Inactive — portal access disabled'}
          </div>
        </div>
      </Modal>
    );
  };
  TS.CoachFormModal = CoachFormModal;

  const RefPanel = ({ data, reload }) => {
    const toast = useToast();
    const [newChapter, setNewChapter] = useState('');
    const [newSport, setNewSport] = useState('');

    const add = (kind, name, clear) => async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      try {
        await TS.api(`/api/${kind}`, { method: 'POST', body: { name: name.trim() } });
        toast(`${name.trim()} added`);
        clear('');
        reload();
      } catch (ex) { toast(ex.message, { error: true }); }
    };

    const usage = (kind, id) => kind === 'chapters'
      ? data.coaches.filter((c) => c.chapter_id === id).length
      : data.coaches.filter((c) => c.sport_id === id).length;

    const List = ({ kind, rows, value, setValue }) => (
      <section className="ts-card ts-setcard" style={{ gridColumn: 'auto' }}>
        <div className="ts-setcard-head">
          <Ic name={kind === 'chapters' ? 'globe' : 'medal'} size={18} />
          <div>
            <h2 className="ts-card-title">{kind === 'chapters' ? 'Chapters' : 'Sports'}</h2>
            <p className="ts-card-sub">{rows.length} total · used across coaches and sessions</p>
          </div>
        </div>
        <div className="ts-teamlist">
          {rows.map((r) => (
            <div className="ts-teamrow" key={r.id}>
              <div className="ts-team-id">
                <span className="ts-team-name">{kind === 'chapters' ? `${TS.flag(r.name)} ${r.name}` : r.name}</span>
              </div>
              <span className="ts-team-role">{usage(kind, r.id)} coach{usage(kind, r.id) === 1 ? '' : 'es'}</span>
            </div>
          ))}
        </div>
        <form onSubmit={add(kind, value, setValue)} style={{ display: 'flex', gap: 8, paddingTop: 14 }}>
          <Input value={value} placeholder={kind === 'chapters' ? 'New chapter name…' : 'New sport…'}
                 onChange={(e) => setValue(e.target.value)} />
          <Btn sm type="submit" icon="plus">Add</Btn>
        </form>
      </section>
    );

    return (
      <div className="ts-settings" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <List kind="chapters" rows={data.chapters} value={newChapter} setValue={setNewChapter} />
        <List kind="sports" rows={data.sports} value={newSport} setValue={setNewSport} />
      </div>
    );
  };

  const Manage = ({ data, reload, chapterFilter }) => {
    const toast = useToast();
    const [tab, setTab] = useState('coaches');
    const [q, setQ] = useState('');
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const coaches = useMemo(() => {
      let list = data.coaches;
      if (chapterFilter != null) list = list.filter((c) => c.chapter_id === chapterFilter);
      const needle = q.trim().toLowerCase();
      if (needle) list = list.filter((c) => [c.name, c.email, c.chapter, c.sport, c.access_code].some((v) => (v || '').toLowerCase().includes(needle)));
      return list;
    }, [data.coaches, q, chapterFilter]);

    const sessionCount = (id) => data.sessions.filter((s) => s.coach_id === id).length;

    const toggleActive = async (c) => {
      try {
        await TS.api(`/api/coaches/${c.id}`, { method: 'PUT', body: { ...c, active: c.active ? 0 : 1 } });
        toast(c.active ? `${c.name} deactivated` : `${c.name} activated`);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    const genCode = async (c) => {
      const code = TS.genAccessCode();
      try {
        await TS.api(`/api/coaches/${c.id}`, { method: 'PUT', body: { ...c, access_code: code } });
        try { await navigator.clipboard?.writeText(code); } catch {}
        toast(`Code ${code} set for ${c.name} (copied)`);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    const copyCode = (c) => {
      navigator.clipboard?.writeText(c.access_code)
        .then(() => toast(`${c.name}’s code copied`))
        .catch(() => toast('Couldn’t copy', { error: true }));
    };

    const doDelete = async (c) => {
      try {
        await TS.api(`/api/coaches/${c.id}`, { method: 'DELETE' });
        toast(`${c.name} removed`);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="users" eyebrow="People" title="Manage coaches"
          lede="Portal access, contact details, chapters and sports — the admin side of your roster."
          actions={<Btn kind="primary" icon="plus" onClick={() => setEditing({})}>Add coach</Btn>} />

        <div className="ts-filterbar">
          <Seg value={tab} onChange={setTab}
               options={[{ value: 'coaches', label: 'Coaches' }, { value: 'refs', label: 'Chapters & sports' }]} />
          {tab === 'coaches' && (
            <>
              <div className="ts-filterbar-search">
                <Ic name="search" size={15} />
                <input value={q} placeholder="Search name, email, code…" onChange={(e) => setQ(e.target.value)} />
              </div>
              <span className="ts-filter-meta"><strong>{coaches.length}</strong> coaches</span>
            </>
          )}
        </div>

        {tab === 'refs' ? <RefPanel data={data} reload={reload} /> : (
          <section className="ts-card ts-tablecard">
            <div className="ts-table ts-table--manage">
              <div className="ts-tr ts-tr--manage ts-tr--head">
                <span>Coach</span><span>Chapter</span><span>Sport</span><span>Active</span>
                <span>Portal code</span><span style={{ textAlign: 'right' }}>Sessions</span><span />
              </div>
              {coaches.length === 0 && (
                <div className="ts-table-empty">
                  <Empty icon="users" title="No coaches found" body="Try a different search, or add a coach." />
                </div>
              )}
              {coaches.map((c) => (
                <div className="ts-tr ts-tr--manage" key={c.id}>
                  <span className="ts-coach">
                    <Avatar name={c.name} size={32} />
                    <span className="ts-coach-meta">
                      <span className="ts-coach-name">{c.name}</span>
                      <span className="ts-coach-mail">{c.email || 'no email'}</span>
                    </span>
                  </span>
                  <span className="ts-td-loc">{c.chapter ? `${TS.flag(c.chapter)} ${c.chapter}` : '—'}</span>
                  <span><SportTag name={c.sport} sm /></span>
                  <span><Toggle on={!!c.active} onChange={() => toggleActive(c)} label={`${c.name} active`} /></span>
                  <span>
                    {c.access_code
                      ? <span className="ts-code"><span className="ts-mono">{c.access_code}</span>
                          <button onClick={() => copyCode(c)} title="Copy code"><Ic name="copy" size={13} /></button></span>
                      : <button className="ts-link" onClick={() => genCode(c)}><Ic name="key" size={13} /> Generate</button>}
                  </span>
                  <span className="ts-num" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>{sessionCount(c.id)}</span>
                  <span className="ts-rowactions">
                    <IconBtn icon="edit" title="Edit" onClick={() => setEditing(c)} />
                    <IconBtn icon="trash" danger title="Delete" onClick={() => setDeleting(c)} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {editing && <CoachFormModal coach={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />}
        {deleting && (
          <Confirm title={`Remove ${deleting.name}?`}
            body={`This deletes ${deleting.name} from the roster. Their ${sessionCount(deleting.id)} logged session${sessionCount(deleting.id) === 1 ? '' : 's'} will remain but show no coach. This can’t be undone.`}
            confirmLabel="Remove coach"
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.manage = Manage;
})();
