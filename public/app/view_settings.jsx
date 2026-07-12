/* view_settings.jsx — org settings, brand kit, data export, quick links. */

(() => {
  const TS = window.TS;
  const { useState } = React;
  const { Ic, Btn, PageHead, Field, Input, useToast } = TS.ui;

  const SWATCHES = [
    { name: 'Ink', hex: '#0A0D28' },
    { name: 'Forest', hex: '#285400' },
    { name: 'Peach', hex: '#F6A15C' },
    { name: 'Lime', hex: '#87CB4A' },
    { name: 'Cream', hex: '#F6F5EC' },
    { name: 'Sand', hex: '#EFEDDF' },
  ];

  const Settings = ({ data, reload, setView }) => {
    const toast = useToast();
    const [f, setF] = useState({
      org_name: data.settings.org_name || 'Together Sports',
      contact_email: data.settings.contact_email || '',
      monthly_goal: data.settings.monthly_goal || '20',
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
              <a href="/submit.html" target="_blank" rel="noopener">
                <Ic name="quote" size={16} /> Testimonial form <span>for families</span>
              </a>
            </div>
            <div className="ts-notifrow" style={{ borderBottom: 0, marginTop: 6 }}>
              <div>
                <div className="ts-notif-title">Admin password</div>
                <div className="ts-notif-desc">
                  Set via the <span className="ts-mono">ADMIN_PASSWORD</span> environment variable on the server — change it there, then sign in again.
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
