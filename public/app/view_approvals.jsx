/* view_approvals.jsx — testimonial moderation (pending → approved → public)
   and pending photo review. */

(() => {
  const TS = window.TS;
  const { useState, useMemo } = React;
  const { Ic, Btn, IconBtn, PageHead, Tag, Avatar, Seg, Confirm, Empty, useToast } = TS.ui;

  const statusOf = (t) => (t.public ? 'public' : t.approved ? 'approved' : 'pending');
  const STATUS_TAG = {
    pending: { label: 'Waiting for review', bg: 'var(--peach-soft)', fg: '#8A4A12' },
    approved: { label: 'Approved · internal', bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
    public: { label: 'Live on impact page', bg: 'var(--lime-soft)', fg: '#3E6B12' },
  };

  const Approvals = ({ data, reload, setView, chapterFilter }) => {
    const toast = useToast();
    const [tab, setTab] = useState('pending');
    const [deleting, setDeleting] = useState(null);

    const testimonials = useMemo(() => {
      let list = data.testimonials;
      if (chapterFilter != null) list = list.filter((t) => t.chapter_id === chapterFilter);
      if (tab !== 'all') list = list.filter((t) => statusOf(t) === tab);
      return list;
    }, [data.testimonials, tab, chapterFilter]);

    const counts = useMemo(() => {
      const c = { pending: 0, approved: 0, public: 0 };
      for (const t of data.testimonials) c[statusOf(t)]++;
      return c;
    }, [data.testimonials]);

    const pendingPhotos = data.photos.filter((p) => !p.approved);

    const setStatus = async (t, approved, pub, msg) => {
      try {
        await TS.api(`/api/testimonials/${t.id}`, { method: 'PUT', body: { approved, public: pub } });
        toast(msg);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    const doDelete = async (t) => {
      try {
        await TS.api(`/api/testimonials/${t.id}`, { method: 'DELETE' });
        toast('Testimonial deleted');
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    const approvePhoto = async (p, approved) => {
      try {
        await TS.api(`/api/photos/${p.id}`, { method: 'PUT', body: { approved: approved ? 1 : 0 } });
        toast(approved ? 'Photo approved' : 'Photo rejected');
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="badge-check" eyebrow="Content" title="Approvals"
          lede="Stories and photos from coaches and families. Nothing goes on the public impact page without your sign-off." />

        {pendingPhotos.length > 0 && (
          <section className="ts-card ts-photos">
            <div className="ts-card-head">
              <div>
                <h2 className="ts-card-title">Photos waiting for review</h2>
                <p className="ts-card-sub">Uploaded from the coach portal</p>
              </div>
              <span className="ts-countchip">{pendingPhotos.length}</span>
            </div>
            <div className="ts-photogrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {pendingPhotos.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="ui-photo" style={{ aspectRatio: '4 / 3' }}>
                    <img src={p.url} alt={p.caption || 'Pending photo'} loading="lazy" />
                    {p.chapter && <span className="ui-photo-tag">{p.chapter}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn kind="primary" sm icon="check" onClick={() => approvePhoto(p, true)}>Approve</Btn>
                    <Btn sm icon="x" onClick={() => approvePhoto(p, false)}>Keep hidden</Btn>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="ts-filterbar">
          <Seg value={tab} onChange={setTab} options={[
            { value: 'pending', label: counts.pending ? `Pending (${counts.pending})` : 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'public', label: counts.public ? `Public (${counts.public})` : 'Public' },
            { value: 'all', label: 'All' },
          ]} />
          <span className="ts-filter-meta"><strong>{testimonials.length}</strong> testimonials</span>
        </div>

        {testimonials.length === 0
          ? <section className="ts-card" style={{ padding: 30 }}>
              <Empty icon="quote"
                     title={tab === 'pending' ? 'Nothing waiting for review' : 'No testimonials here'}
                     body={tab === 'pending'
                       ? 'When families or coaches submit stories, they’ll land here first.'
                       : 'Testimonials move here as you approve and publish them.'} />
            </section>
          : <div className="ts-approvals">
              {testimonials.map((t) => {
                const st = statusOf(t);
                const tag = STATUS_TAG[st];
                return (
                  <article className={`ts-testcard${st === 'pending' ? ' is-pending' : ''}`} key={t.id}>
                    <div className="ts-testcard-top">
                      <Avatar name={t.parent_name || t.coach_name} size={36} />
                      <div className="ts-testcard-meta">
                        <b>{t.parent_name || 'Anonymous'}{t.child_name ? `, parent of ${t.child_name}` : ''}</b>
                        <span>via {t.coach_name} · {TS.fmtDate(t.created_at)}</span>
                      </div>
                    </div>
                    {t.photo_url && <div className="ts-testcard-photo"><img src={t.photo_url} alt="" loading="lazy" /></div>}
                    <p className="ts-testcard-quote">{t.quote}</p>
                    <div className="ts-testcard-tags">
                      <Tag sm bg={tag.bg} fg={tag.fg}>{tag.label}</Tag>
                      {t.chapter && <Tag sm bg="var(--surface-2)" fg="var(--muted)">{TS.flag(t.chapter)} {t.chapter}</Tag>}
                      {t.sport && <TS.ui.SportTag name={t.sport} sm />}
                    </div>
                    <div className="ts-testcard-foot">
                      {st === 'pending' && <>
                        <Btn kind="primary" sm icon="check" onClick={() => setStatus(t, 1, 0, 'Approved — publish it when ready')}>Approve</Btn>
                        <Btn sm icon="globe" onClick={() => setStatus(t, 1, 1, 'Published to the impact page')}>Approve &amp; publish</Btn>
                      </>}
                      {st === 'approved' && <>
                        <Btn kind="primary" sm icon="globe" onClick={() => setStatus(t, 1, 1, 'Published to the impact page')}>Publish</Btn>
                        <Btn sm onClick={() => setStatus(t, 0, 0, 'Moved back to pending')}>Back to pending</Btn>
                      </>}
                      {st === 'public' && (
                        <Btn sm icon="x" onClick={() => setStatus(t, 1, 0, 'Unpublished — kept as approved')}>Unpublish</Btn>
                      )}
                      <IconBtn icon="trash" danger title="Delete" onClick={() => setDeleting(t)} />
                    </div>
                  </article>
                );
              })}
            </div>}

        {deleting && (
          <Confirm title="Delete this testimonial?"
            body={`This permanently removes the story from ${deleting.parent_name || deleting.coach_name}${deleting.photo_url ? ' and its photo' : ''}. This can’t be undone.`}
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.approvals = Approvals;
})();
