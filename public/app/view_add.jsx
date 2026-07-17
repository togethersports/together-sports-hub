/* view_add.jsx — log a session: form with live preview card. */

(() => {
  const TS = window.TS;
  const { useState } = React;
  const { Ic, Btn, PageHead, Field, Input, Select, Textarea, Stepper, useToast } = TS.ui;

  const BLANK = {
    session_date: '', coach_id: '', chapter_id: '', sport_id: '',
    participants: '', duration_minutes: 60, location: '', notes: '',
  };

  const AddSession = ({ data, reload, setView }) => {
    const toast = useToast();
    const [f, setF] = useState({ ...BLANK, session_date: TS.today() });
    const [errs, setErrs] = useState({});
    const [busy, setBusy] = useState(false);
    const set = (k) => (v) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => ({ ...e, [k]: null })); };

    const pickCoach = (id) => {
      const c = data.coaches.find((x) => String(x.id) === String(id));
      setF((x) => ({
        ...x, coach_id: id,
        // Follow the coach's home chapter/sport unless already chosen.
        chapter_id: x.chapter_id || c?.chapter_id || '',
        sport_id: x.sport_id || c?.sport_id || '',
      }));
      setErrs((e) => ({ ...e, coach_id: null }));
    };

    const chapterName = data.chapters.find((c) => String(c.id) === String(f.chapter_id))?.name;
    const sportName = data.sports.find((s) => String(s.id) === String(f.sport_id))?.name;
    const coachName = data.coaches.find((c) => String(c.id) === String(f.coach_id))?.name;

    const submit = async (andAnother) => {
      const e = {};
      if (!f.session_date) e.session_date = 'Pick a date';
      if (!f.sport_id) e.sport_id = 'Pick a sport';
      if (f.participants === '' || Number(f.participants) < 0) e.participants = 'How many kids came?';
      if (Object.keys(e).length) { setErrs(e); return; }
      setBusy(true);
      try {
        await TS.api('/api/sessions', { method: 'POST', body: {
          session_date: f.session_date,
          coach_id: f.coach_id || null, chapter_id: f.chapter_id || null, sport_id: f.sport_id || null,
          participants: Number(f.participants) || 0,
          duration_minutes: f.duration_minutes === '' ? null : Number(f.duration_minutes),
          location: f.location || null, notes: f.notes || null,
          submitted_by: 'admin',
        }});
        toast(`Session logged — ${Number(f.participants) || 0} kid${Number(f.participants) === 1 ? '' : 's'} reached`, {
          action: andAnother ? undefined : { label: 'View sessions', fn: () => setView('sessions') },
        });
        reload();
        if (andAnother) {
          setF((x) => ({ ...BLANK, session_date: x.session_date, coach_id: x.coach_id, chapter_id: x.chapter_id, sport_id: x.sport_id }));
        } else {
          setView('sessions');
        }
      } catch (ex) { toast(ex.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <div className="view">
        <PageHead icon="calendar-plus" eyebrow="Program" title="Log a session"
          lede="Record a coaching session — it flows straight into your impact stats." />

        <div className="ts-addlayout">
          <section className="ts-card ts-form">
            <div className="ts-form-grid">
              <Field label="Date" req error={errs.session_date}>
                <Input type="date" value={f.session_date} invalid={!!errs.session_date}
                       onChange={(e) => set('session_date')(e.target.value)} />
              </Field>
              <Field label="Coach" hint="Optional — leave blank for org-run events.">
                <Select value={f.coach_id} onChange={(e) => pickCoach(e.target.value)}>
                  <option value="">No coach</option>
                  {data.coaches.filter((c) => c.name !== 'Coach TBD').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.chapter ? ` — ${c.chapter}` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Sport" req error={errs.sport_id} className="ts-form-full">
                <div className="ts-sportpick">
                  {data.sports.map((s) => {
                    const on = String(f.sport_id) === String(s.id);
                    const style = on ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined;
                    return (
                      <button key={s.id} type="button" className="ts-sportchip" style={style}
                              onClick={() => set('sport_id')(on ? '' : s.id)}>
                        {on && <Ic name="check" size={13} />}{s.name}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Chapter">
                <Select value={f.chapter_id} onChange={(e) => set('chapter_id')(e.target.value)}>
                  <option value="">No chapter</option>
                  {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Location">
                <Input value={f.location} placeholder="e.g. McCarren Park courts"
                       onChange={(e) => set('location')(e.target.value)} />
              </Field>
              <Field label="Kids attending" req error={errs.participants}>
                <Stepper value={f.participants} onChange={set('participants')} invalid={!!errs.participants} />
              </Field>
              <Field label="Duration (minutes)">
                <Stepper value={f.duration_minutes} onChange={set('duration_minutes')} step={15} max={600} />
              </Field>
              <Field label="Notes" className="ts-form-full">
                <Textarea rows={3} value={f.notes} placeholder="Wins, challenges, anything worth remembering…"
                          onChange={(e) => set('notes')(e.target.value)} />
              </Field>
            </div>
            <div className="ts-form-actions">
              <Btn type="button" onClick={() => submit(true)} disabled={busy}>Save &amp; log another</Btn>
              <Btn kind="primary" icon="check" type="button" onClick={() => submit(false)} disabled={busy}>
                {busy ? 'Saving…' : 'Log session'}
              </Btn>
            </div>
          </section>

          <aside className="ts-card ts-preview">
            <div className="ts-preview-label">Live preview</div>
            <div className="ts-preview-sport"><Ic name="medal" size={18} />{sportName || 'Pick a sport'}</div>
            <div className="ts-preview-kids">{f.participants === '' ? '–' : f.participants}<span>kids attending</span></div>
            <div className="ts-preview-rows">
              <div className="ts-preview-row"><Ic name="calendar" size={14} />{f.session_date ? TS.fmtFull(f.session_date) : 'No date yet'}</div>
              <div className="ts-preview-row"><Ic name="whistle" size={14} />{coachName || 'No coach assigned'}</div>
              <div className="ts-preview-row"><Ic name="pin" size={14} />{f.location || chapterName || 'No location yet'}</div>
              <div className="ts-preview-row"><Ic name="clock" size={14} />{TS.fmtDuration(f.duration_minutes)}</div>
            </div>
            <div className="ts-preview-note">
              {f.notes ? `“${f.notes}”` : 'This is how the session will read in your impact log.'}
            </div>
          </aside>
        </div>
      </div>
    );
  };

  TS.views.add = AddSession;
})();
