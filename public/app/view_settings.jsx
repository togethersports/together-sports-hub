/* view_settings.jsx — org settings, brand kit, data export, quick links. */

(() => {
  const TS = window.TS;
  const { useState, useEffect } = React;
  const { Ic, Btn, IconBtn, PageHead, Field, Input, Confirm, useToast } = TS.ui;

  const SWATCHES = [
    { name: 'Ink', hex: '#0A0D28' },
    { name: 'Forest', hex: '#285400' },
    { name: 'Peach', hex: '#F6A15C' },
    { name: 'Lime', hex: '#87CB4A' },
    { name: 'Cream', hex: '#F6F5EC' },
    { name: 'Sand', hex: '#EFEDDF' },
  ];

  const PasswordCard = ({ toast }) => {
    const [f, setF] = useState({ current: '', next: '', confirm: '' });
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

    const change = async () => {
      if (f.next !== f.confirm) { toast('New passwords don’t match', { error: true }); return; }
      if (f.next.length < 8) { toast('New password must be at least 8 characters', { error: true }); return; }
      setBusy(true);
      try {
        await TS.api('/api/change-password', { method: 'POST', body: { current: f.current, next: f.next } });
        TS.setToken(f.next); // keep this session signed in with the new password
        setF({ current: '', next: '', confirm: '' });
        toast('Admin password changed');
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <section className="ts-card ts-setcard">
        <div className="ts-setcard-head">
          <Ic name="shield" size={18} />
          <div>
            <h2 className="ts-card-title">Admin password</h2>
            <p className="ts-card-sub">Change the password used to open this dashboard. Takes effect immediately.</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Current password">
            <Input type="password" value={f.current} autoComplete="current-password" onChange={set('current')} />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input type="password" value={f.next} autoComplete="new-password" onChange={set('next')} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={f.confirm} autoComplete="new-password" onChange={set('confirm')} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn kind="primary" icon="shield" onClick={change} disabled={busy || !f.current || !f.next || !f.confirm}>
              {busy ? 'Changing…' : 'Change password'}
            </Btn>
          </div>
        </div>
      </section>
    );
  };

  // A view key unlocks /viewer.html — the same depth as the admin dashboard
  // (sessions, participants, parent contacts, coaches, stories, photos) with
  // no write access at all: no create/edit/delete endpoint accepts a view
  // key, so a link can only ever be read, never used to change anything.
  const ViewKeysCard = ({ toast }) => {
    const [keys, setKeys] = useState(null);
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [revoking, setRevoking] = useState(null);

    const load = async () => {
      try { setKeys(await TS.api('/api/view-keys')); }
      catch (e) { toast(e.message, { error: true }); }
    };
    useEffect(() => { load(); }, []);

    const shareUrl = (code) => `${window.location.origin}/viewer.html?key=${code}`;

    const copy = async (text, what) => {
      try { await navigator.clipboard.writeText(text); toast(`${what} copied`); }
      catch { toast('Couldn’t copy — select and copy manually', { error: true }); }
    };

    const create = async () => {
      if (!label.trim() || busy) return;
      setBusy(true);
      try {
        const row = await TS.api('/api/view-keys', { method: 'POST', body: { label: label.trim() } });
        setLabel('');
        await load();
        copy(shareUrl(row.key_code), 'Share link');
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    const revoke = async (row) => {
      try {
        await TS.api(`/api/view-keys/${row.id}`, { method: 'DELETE' });
        toast(`Revoked “${row.label}” — that link no longer works`);
        setRevoking(null);
        load();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <section className="ts-card ts-setcard">
        <div className="ts-setcard-head">
          <Ic name="eye" size={18} />
          <div>
            <h2 className="ts-card-title">Shareable view-only links</h2>
            <p className="ts-card-sub">
              Let someone outside your coach team see everything you see — sessions, kids, parent contacts,
              coaches, stories, photos — with no ability to change anything. Good for a board member,
              funder, or a college counselor who wants the full picture.
            </p>
          </div>
        </div>

        <div className="ts-notifrow" style={{ borderBottom: keys?.length ? undefined : 0, alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Label" hint="Who is this link for? (shown to you only)">
              <Input value={label} placeholder="e.g. Maya's college counselor"
                     onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
                     onChange={(e) => setLabel(e.target.value)} />
            </Field>
          </div>
          <Btn kind="primary" icon="plus" onClick={create} disabled={busy || !label.trim()}>
            {busy ? 'Creating…' : 'Create link'}
          </Btn>
        </div>

        {keys === null ? (
          <p className="ts-card-sub" style={{ padding: '12px 0' }}>Loading…</p>
        ) : keys.length === 0 ? (
          <p className="ts-card-sub" style={{ padding: '12px 0' }}>No links yet — create one above.</p>
        ) : (
          <div>
            {keys.map((k) => (
              <div className="ts-datarow" key={k.id} style={{ alignItems: 'center' }}>
                <div className="ts-datarow-main">
                  <div className="ts-notif-title">{k.label}</div>
                  <div className="ts-notif-desc">
                    Created {TS.fmtDate(k.created_at)} · {k.last_used_at ? `last viewed ${TS.fmtDate(k.last_used_at)}` : 'never opened yet'}
                  </div>
                </div>
                <Btn sm icon="copy" onClick={() => copy(shareUrl(k.key_code), 'Share link')}>Copy link</Btn>
                <IconBtn icon="trash" danger title="Revoke" onClick={() => setRevoking(k)} />
              </div>
            ))}
          </div>
        )}

        {revoking && (
          <Confirm title={`Revoke “${revoking.label}”?`}
            body="This link stops working immediately. Anyone who has it will be signed out next time they load the page."
            confirmLabel="Revoke link"
            onConfirm={() => revoke(revoking)} onClose={() => setRevoking(null)} />
        )}
      </section>
    );
  };

  const Settings = ({ data, reload, setView }) => {
    const toast = useToast();
    const [f, setF] = useState({
      org_name: data.settings.org_name || 'Together Sports',
      contact_email: data.settings.contact_email || '',
      monthly_goal: data.settings.monthly_goal || '20',
      dollars_raised: data.settings.dollars_raised || '',
    });
    const [busy, setBusy] = useState(false);

    const save = async () => {
      setBusy(true);
      try {
        await TS.api('/api/settings', { method: 'POST', body: f });
        toast('Settings saved');
        reload();
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    const exports = [
      { label: 'Sessions', count: data.sessions.length, fn: () => TS.exportCsv('sessions.csv',
          ['Date', 'Coach', 'Chapter', 'Sport', 'Kids', 'Duration (min)', 'Location', 'Notes'],
          data.sessions.map((s) => [s.session_date, s.coach, s.chapter, s.sport, s.participants, s.duration_minutes, s.location, s.notes])) },
      { label: 'Volunteer logs', count: data.volunteerLogs.length, fn: () => TS.exportCsv('volunteer-logs.csv',
          ['Date', 'Coach', 'Activity', 'People helped', 'Hours', 'Chapter', 'Description'],
          data.volunteerLogs.map((v) => [v.log_date, v.coach, v.activity_type, v.people_helped, v.hours, v.chapter, v.description])) },
      { label: 'Participants', count: data.participants.length, fn: () => TS.exportCsv('participants.csv',
          ['Name', 'Parent', 'Contact', 'Session date', 'Coach', 'Chapter'],
          data.participants.map((p) => [p.name, p.parent_name, p.parent_contact, p.session_date, p.coach, p.chapter])) },
      { label: 'Coaches', count: data.coaches.length, fn: () => TS.exportCsv('coaches.csv',
          ['Name', 'Email', 'Phone', 'Chapter', 'Sport', 'Active', 'Access code'],
          data.coaches.map((c) => [c.name, c.email, c.phone, c.chapter, c.sport, c.active ? 'yes' : 'no', c.access_code])) },
    ];

    return (
      <div className="view">
        <PageHead icon="sliders" eyebrow="System" title="Settings"
          lede="Organization details, brand kit, and your data." />

        <div className="ts-settings">
          <section className="ts-card ts-setcard">
            <div className="ts-setcard-head">
              <Ic name="sparkle" size={18} />
              <div>
                <h2 className="ts-card-title">Brand kit</h2>
                <p className="ts-card-sub">The mark and palette this dashboard is built on</p>
              </div>
            </div>
            <div className="ts-brandrow">
              <div className="ts-logoslot">
                <img className="ts-logo-img--lg" src="assets/ts-mark.png" alt="Together Sports mark" />
                <span className="ts-slot-cap">assets/ts-mark.png</span>
              </div>
              <div className="ts-logoslot">
                <img className="ts-logo-img--lg" src="assets/ts-mark.png" alt="" style={{ background: 'var(--ink)', borderColor: 'var(--ink)' }} />
                <span className="ts-slot-cap">on ink</span>
              </div>
              <div className="ts-swatches">
                {SWATCHES.map((s) => (
                  <div className="ts-swatch" key={s.name}>
                    <div className="ts-swatch-chip" style={{ background: s.hex }} />
                    <span className="ts-swatch-name">{s.name}</span>
                    <span className="ts-swatch-hex">{s.hex}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ts-card ts-setcard">
            <div className="ts-setcard-head">
              <Ic name="home" size={18} />
              <div>
                <h2 className="ts-card-title">Organization</h2>
                <p className="ts-card-sub">Used across the dashboard and public pages</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Organization name">
                <Input value={f.org_name} onChange={(e) => setF({ ...f, org_name: e.target.value })} />
              </Field>
              <Field label="Contact email">
                <Input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} />
              </Field>
              <Field label="Monthly session goal" hint="Drives the progress bar in the sidebar.">
                <Input type="number" min="1" value={f.monthly_goal} onChange={(e) => setF({ ...f, monthly_goal: e.target.value })} />
              </Field>
              <Field label="Total dollars raised" hint="Shown as the “dollars raised” metric on the shared Impact Viewer. Numbers only.">
                <Input type="number" min="0" step="1" value={f.dollars_raised} placeholder="e.g. 4500"
                       onChange={(e) => setF({ ...f, dollars_raised: e.target.value })} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Btn kind="primary" icon="check" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Btn>
              </div>
            </div>
          </section>

          <section className="ts-card ts-setcard">
            <div className="ts-setcard-head">
              <Ic name="download" size={18} />
              <div>
                <h2 className="ts-card-title">Your data</h2>
                <p className="ts-card-sub">Everything lives in one SQLite file on the server — export any of it as CSV</p>
              </div>
            </div>
            <div>
              {exports.map((x) => (
                <div className="ts-datarow" key={x.label}>
                  <div className="ts-datarow-main">
                    <div className="ts-notif-title">{x.label}</div>
                    <div className="ts-notif-desc">{x.count} record{x.count === 1 ? '' : 's'}</div>
                  </div>
                  <Btn sm icon="download" onClick={() => { x.fn(); toast(`${x.label} CSV downloaded`); }}>Export</Btn>
                </div>
              ))}
            </div>
          </section>

          <ViewKeysCard toast={toast} />

          <PasswordCard toast={toast} />

          <section className="ts-card ts-setcard">
            <div className="ts-setcard-head">
              <Ic name="external" size={18} />
              <div>
                <h2 className="ts-card-title">Quick links &amp; access</h2>
                <p className="ts-card-sub">The other doors into this system</p>
              </div>
            </div>
            <div className="ts-quicklinks">
              <a href="/impact.html" target="_blank" rel="noopener">
                <Ic name="globe" size={16} /> Public impact page <span>anyone can view</span>
              </a>
              <a href="/coach.html" target="_blank" rel="noopener">
                <Ic name="whistle" size={16} /> Coach portal <span>needs access code</span>
              </a>
              <a href="/outreach.html" target="_blank" rel="noopener">
                <Ic name="sparkle" size={16} /> Outreach HQ <span>AI-assisted, per coach</span>
              </a>
              <a href="/submit.html" target="_blank" rel="noopener">
                <Ic name="quote" size={16} /> Testimonial form <span>for families</span>
              </a>
            </div>
            <div className="ts-notifrow" style={{ borderBottom: 0, marginTop: 6 }}>
              <div>
                <div className="ts-notif-title">Locked out?</div>
                <div className="ts-notif-desc">
                  The admin password is managed in the card above. If it's ever lost, delete the
                  <span className="ts-mono"> admin_password</span> row from the settings table in
                  <span className="ts-mono"> data/together.db</span> — access falls back to the
                  <span className="ts-mono"> ADMIN_PASSWORD</span> environment variable.
                </div>
              </div>
              <Ic name="shield" size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </section>
        </div>
      </div>
    );
  };

  TS.views.settings = Settings;
})();
