/* view_gallery.jsx — photo gallery: upload, lightbox, approve, delete. */

(() => {
  const TS = window.TS;
  const { useState, useRef, useMemo, useEffect } = React;
  const { Ic, Btn, PageHead, Tag, Field, Input, Select, Seg, Modal, Confirm, Empty, useToast } = TS.ui;

  const UploadModal = ({ data, onClose, onSaved }) => {
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [caption, setCaption] = useState('');
    const [chapterId, setChapterId] = useState('');
    const [sportId, setSportId] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);

    const pick = (fl) => {
      if (!fl || !fl.type.startsWith('image/')) return;
      if (fl.size > 10 * 1024 * 1024) { toast('Images must be under 10 MB', { error: true }); return; }
      setFile(fl);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(fl);
    };

    const save = async () => {
      if (!file) { toast('Choose a photo first', { error: true }); return; }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('photo', file);
        if (caption) fd.append('caption', caption);
        if (chapterId) fd.append('chapter_id', chapterId);
        if (sportId) fd.append('sport_id', sportId);
        await TS.api('/api/photos', { method: 'POST', body: fd });
        toast('Photo added to the gallery');
        onSaved();
        onClose();
      } catch (e) { toast(e.message, { error: true }); }
      finally { setBusy(false); }
    };

    return (
      <Modal title="Upload a photo" sub="Approved photos can appear on the public impact page." onClose={onClose}
        foot={<>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn kind="primary" icon="upload" onClick={save} disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload photo'}</Btn>
        </>}>
        <div className="ts-upload">
          <div className="ts-uploaddrop" onClick={() => inputRef.current?.click()}
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
            {preview
              ? <img src={preview} alt="Preview" />
              : <div className="ts-uploaddrop-empty">
                  <Ic name="camera" size={26} />
                  <span className="ts-uploaddrop-title">Drop a photo here</span>
                  <span className="ts-uploaddrop-sub">or click to browse · JPG, PNG, GIF, WebP · up to 10 MB</span>
                </div>}
            <input ref={inputRef} type="file" accept="image/*" hidden
                   onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <Field label="Caption">
            <Input value={caption} placeholder="e.g. Saturday tennis clinic in Brooklyn" onChange={(e) => setCaption(e.target.value)} />
          </Field>
          <div className="ts-form-grid">
            <Field label="Chapter">
              <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">No chapter</option>
                {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Sport">
              <Select value={sportId} onChange={(e) => setSportId(e.target.value)}>
                <option value="">No sport</option>
                {data.sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    );
  };

  const Gallery = ({ data, reload, param, chapterFilter }) => {
    const toast = useToast();
    const [fStatus, setFStatus] = useState('all');
    const [fChapter, setFChapter] = useState('');
    const [uploading, setUploading] = useState(!!param?.upload);
    const [openId, setOpenId] = useState(null);
    const [deleting, setDeleting] = useState(null);

    // Palette can deep-link here with { upload: true } — only honor it once.
    useEffect(() => { if (param?.upload) setUploading(true); }, [param]);

    const photos = useMemo(() => {
      let list = data.photos;
      if (chapterFilter != null) list = list.filter((p) => p.chapter_id === chapterFilter);
      if (fStatus === 'pending') list = list.filter((p) => !p.approved);
      if (fStatus === 'approved') list = list.filter((p) => p.approved);
      if (fChapter) list = list.filter((p) => String(p.chapter_id) === fChapter);
      return list;
    }, [data.photos, fStatus, fChapter, chapterFilter]);

    const open = openId != null ? data.photos.find((p) => p.id === openId) : null;
    const pendingCount = data.photos.filter((p) => !p.approved).length;

    const setApproved = async (p, approved) => {
      try {
        await TS.api(`/api/photos/${p.id}`, { method: 'PUT', body: { approved: approved ? 1 : 0 } });
        toast(approved ? 'Photo approved — visible on the impact page' : 'Photo hidden from the impact page');
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    const doDelete = async (p) => {
      try {
        await TS.api(`/api/photos/${p.id}`, { method: 'DELETE' });
        toast('Photo deleted');
        if (openId === p.id) setOpenId(null);
        reload();
      } catch (e) { toast(e.message, { error: true }); }
    };

    return (
      <div className="view">
        <PageHead icon="image" eyebrow="Content" title="Gallery"
          lede="Photos from the field. Approved photos show on the public impact page."
          actions={<Btn kind="primary" icon="upload" onClick={() => setUploading(true)}>Upload photo</Btn>} />

        <div className="ts-filterbar">
          <Seg value={fStatus} onChange={setFStatus} options={[
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Public' },
            { value: 'pending', label: pendingCount ? `Pending (${pendingCount})` : 'Pending' },
          ]} />
          <div className="ts-filter-field">
            <Select value={fChapter} onChange={(e) => setFChapter(e.target.value)}>
              <option value="">All chapters</option>
              {data.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <span className="ts-filter-meta"><strong>{photos.length}</strong> photos</span>
        </div>

        {photos.length === 0
          ? <section className="ts-card" style={{ padding: 30 }}>
              <Empty icon="camera" title="No photos here yet"
                     body="Upload photos from sessions, or approve ones coaches have submitted."
                     action={<Btn kind="primary" sm icon="upload" onClick={() => setUploading(true)}>Upload photo</Btn>} />
            </section>
          : <div className="ts-gallery">
              {photos.map((p) => (
                <button className="ts-gphoto" key={p.id} onClick={() => setOpenId(p.id)}>
                  <div className="ui-photo" style={{ aspectRatio: '4 / 3' }}>
                    <img src={p.url} alt={p.caption || 'Session photo'} loading="lazy" />
                    {!p.approved && <span className="ts-gphoto-pending"><Tag sm bg="var(--peach)" fg="var(--ink)">Pending</Tag></span>}
                  </div>
                  <div className="ts-gphoto-meta">
                    <div className="ts-gphoto-cap">{p.caption || 'Untitled photo'}</div>
                    <div className="ts-gphoto-sub">
                      {p.sport && <TS.ui.SportTag name={p.sport} sm />}
                      <span className="ts-gphoto-chap">{p.chapter ? `${TS.flag(p.chapter)} ${p.chapter}` : ''}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>}

        {uploading && <UploadModal data={data} onClose={() => setUploading(false)} onSaved={reload} />}

        {open && (
          <Modal title={open.caption || 'Photo'} wide
                 sub={[open.chapter, open.sport, TS.fmtDate(open.uploaded_at)].filter(Boolean).join(' · ')}
                 onClose={() => setOpenId(null)}
            foot={<>
              <Btn icon="trash" onClick={() => setDeleting(open)}>Delete</Btn>
              {open.approved
                ? <Btn icon="x" onClick={() => setApproved(open, false)}>Hide from public</Btn>
                : <Btn kind="primary" icon="check" onClick={() => setApproved(open, true)}>Approve for public</Btn>}
            </>}>
            <div className="ts-lightbox">
              <div className="ui-photo"><img src={open.url} alt={open.caption || 'Session photo'} /></div>
              <div className="ts-lightbox-meta">
                <Tag sm bg={open.approved ? 'var(--lime-soft)' : 'var(--peach-soft)'} fg={open.approved ? '#3E6B12' : '#8A4A12'}>
                  {open.approved ? 'Public — shown on impact page' : 'Pending approval'}
                </Tag>
              </div>
            </div>
          </Modal>
        )}
        {deleting && (
          <Confirm title="Delete this photo?"
            body="The image file is removed permanently. This can’t be undone."
            onConfirm={() => doDelete(deleting)} onClose={() => setDeleting(null)} />
        )}
      </div>
    );
  };

  TS.views.gallery = Gallery;
})();
