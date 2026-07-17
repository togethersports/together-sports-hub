/* view_partners.jsx — partner log: schools, businesses, funders and venues
   the org works with. Feeds the "partnerships" number on the Impact Viewer. */

(() => {
  const TS = window.TS;
  const { useState, useMemo } = React;
  const { Ic, Btn, IconBtn, PageHead, Tag, Avatar, Field, Input, Select, Textarea,
          Seg, Modal, Confirm, Empty, useToast } = TS.ui;

  const TYPES = ['School', 'Business', 'Nonprofit', 'Venue', 'Funder', 'Community'];
  const STATUSES = ['Active', 'Prospect', 'Past'];
  const STATUS_STYLE = {
    Active:   { bg: 'var(--lime-soft)',  fg: '#3E6B12' },
    Prospect: { bg: 'var(--peach-soft)', fg: '#8A4A12' },
    Past:     { bg: 'var(--surface-2)',  fg: 'var(--muted)' },
  };
  const TYPE_STYLE = {
    School:    { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
    Business:  { bg: '#E4E6F2',            fg: '#3A3F63' },
    Nonprofit: { bg: 'var(--lime-soft)',   fg: '#3E6B12' },
    Venue:     { bg: 'var(--peach-soft)',  fg: '#8A4A12' },
    Funder:    { bg: '#F2E4EE',            fg: '#7A2E52' },
    Community: { bg: 'var(--surface-2)',   fg: 'var(--muted)' },
  };

  const PartnerFormModal = ({ partner, data, onClose, onSaved }) => {
    const toast = useToast();
    const isNew = !partner.id;
    const [f, setF] = useState({
      name: partner.name || '', org_type: partner.org_type || 'School',
      status: partner.status || 'Active', contact_name: partner.contact_name || '',
      email: partner.email || '', phone: partner.phone || '',
      chapter_id: partner.chapter_id || '', since: partner.since || '',
      notes: partner.notes || '',
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

    const save = async () => {
      if (!f.name.trim()) { setErr('A partner name is required'); return; }
      setBusy(true);
      try {
        const body = { ...f, name: f.name.trim(), chapter_id: f.chapter_id || null };
        if (isNew) await TS.api('/api/partners', { method: 'POST', body });
        else await TS.api(`/api/partners/${partner.id}`, { method: 'PUT', body });
        toast(isNew ? `${f.name.trim()} added to the partner log` : 'Partner updated');
        onSaved();
        onClose();
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <Modal title={isNew ? 'Add a partner' : `Edit ${partner.name}`}
             sub="Active partners count toward the partnerships number on the Impact Viewer." wide onClose={onClose}
        foot={<>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add partner' : 'Save changes'}</Btn>
        </>}>
        <div className="ts-form-grid ts-coachform">
          <Field label="Organization name" req error={err}>
            <Input value={f.name} invalid={!!err} autoFocus={isNew} placeholder="e.g. PS 84 / Greenpoint Rec Center"
                   onChange={(e) => { set('name')(e.target.value); setErr(''); }} />
          </Field>
          <Field label="Type">
            <Select value={f.org_type} onChange={(e) => set('org_type')(e.target.value)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status')(e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Chapter">
            <Select value={f.chapter_id} onChange={(e) => set('chapter_id')(e.target.value)}>
              <option value="">Org-wide</option>
              {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Contact person">
            <Input value={f.contact_name} placeholder="e.g. Dana Whitfield" onChange={(e) => set('contact_name')(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email} placeholder="contact@org.org" onChange={(e) => set('email')(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} placeholder="(555) 555-5555" onChange={(e) => set('phone')(e.target.value)} />
          </Field>
          <Field label="Partner since">
            <Input type="date" value={f.since} onChange={(e) => set('since')(e.target.value)} />
          </Field>
          <Field label="What they provide" className="ts-form-full" hint="Court time, funding, referrals, equipment — whatever the partnership gives the program.">
            <Textarea rows={2} value={f.notes} placeholder="e.g. Free gym access on Saturdays + intro'd us to the PTA" onChange={(e) => set('notes')(e.target.value)} />
          </Field>
        </div>
      </Modal>
    );
  };

  const Partners = ({ data, reload }) => {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('all');
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);

    const partners = useMemo(() => {
      const s = q.trim().toLowerCase();
      return (data.partners || []).filter((p) => {
        if (status !== 'all' && p.status !== status) return false;
        return !s || [p.name, p.org_type, p.contact_name, p.email, p.chapter, p.notes]
          .some((x) => (x || '').toLowerCase().includes(s));
      });
    }, [data.partners, q, status]);

    const active = (data.partners || []).filter((p) => p.status === 'Active').length;

    const doDelete = async (p) => {
      try {
        await TS.api(`/api/partners/${p.id}`, { method: 'DELETE' });
        toast(`${p.name} removed from the partner log`);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="globe" eyebrow="People" title="Partner log"
          lede={`The schools, businesses, funders and venues behind the program — ${active} active partnership${active === 1 ? '' : 's'} right now. Active partners count on the Impact Viewer.`}
          actions={<Btn kind="primary" icon="plus" onClick={() => setEditing({})}>Add partner</Btn>} />

        <div className="ts-filterbar">
          <Seg value={status} onChange={setStatus}
               options={[{ value: 'all', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
          <div className="ts-filterbar-search">
            <Ic name="search" size={15} />
            <input value={q} placeholder="Search name, contact, chapter…" onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="ts-filter-meta"><strong>{partners.length}</strong> partner{partners.length === 1 ? '' : 's'}</span>
        </div>

        <section className="ts-card ts-tablecard">
          <div className="ts-table ts-table--manage">
            <div className="ts-tr ts-tr--partners ts-tr--head">
              <span>Partner</span><span>Type</span><span>Chapter</span>
              <span>Contact</span><span>Status</span><span>Since</span><span />
            </div>
            {partners.length === 0 && (
              <div className="ts-table-empty">
                <Empty icon="globe" title="No partners logged yet"
                       body="Add the schools, venues and funders you work with — they become the partnerships number on your impact summary." />
              </div>
            )}
            {partners.map((p) => (
              <div className="ts-tr ts-tr--partners" key={p.id}>
                <span className="ts-coach">
                  <Avatar name={p.name} size={32} />
                  <span className="ts-coach-meta">
                    <span className="ts-coach-name">{p.name}</span>
                    <span className="ts-coach-mail">{p.notes || '—'}</span>
                  </span>
                </span>
                <span><Tag sm bg={(TYPE_STYLE[p.org_type] || TYPE_STYLE.Community).bg} fg={(TYPE_STYLE[p.org_type] || TYPE_STYLE.Community).fg}>{p.org_type}</Tag></span>
                <span className="ts-td-loc">{p.chapter ? `${TS.flag(p.chapter)} ${p.chapter}` : 'Org-wide'}</span>
                <span className="ts-coach-meta">
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{p.contact_name || '—'}</span>
                  <span className="ts-coach-mail">{p.email || p.phone || 'no contact info'}</span>
                </span>
                <span><Tag sm bg={(STATUS_STYLE[p.status] || STATUS_STYLE.Active).bg} fg={(STATUS_STYLE[p.status] || STATUS_STYLE.Active).fg}>{p.status}</Tag></span>
                <span className="ts-td-loc">{p.since ? TS.fmtDate(p.since) + ' ' + TS.fmtYear(p.since) : '—'}</span>
                <span className="ts-rowactions">
                  <IconBtn icon="edit" title="Edit" onClick={() => setEditing(p)} />
                  <IconBtn icon="trash" danger title="Delete" onClick={() => setDeleting(p)} />
                </span>
              </div>
            ))}
          </div>
        </section>

        {editing && <PartnerFormModal partner={editing} data={data} onClose={() => setEditing(null)} onSaved={reload} />}
        {deleting && (
          <Confirm title={`Remove ${deleting.name}?`}
            body="This deletes the partner from the log. This can't be undone."
            confirmLabel="Remove partner"
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.partners = Partners;
})();
