/* view_participants.jsx — every kid/contact logged, across sessions and
   volunteer activities. */

(() => {
  const TS = window.TS;
  const { useState, useMemo } = React;
  const { Ic, Btn, PageHead, Avatar, Tag, Select, Empty, SortHead, useToast } = TS.ui;

  const Participants = ({ data, chapterFilter }) => {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [fChapter, setFChapter] = useState('');
    const [sort, setSort] = useState({ col: 'added', dir: 'desc' });

    // Volunteer-linked participants don't come with join fields — resolve
    // their context from the volunteer logs we already have.
    const volById = useMemo(() => {
      const m = new Map();
      for (const v of data.volunteerLogs) m.set(v.id, v);
      return m;
    }, [data.volunteerLogs]);

    const enriched = useMemo(() => data.participants.map((p) => {
      if (p.volunteer_log_id && volById.has(p.volunteer_log_id)) {
        const v = volById.get(p.volunteer_log_id);
        return { ...p, source: v.activity_type, source_date: v.log_date, coach: v.coach, chapter: v.chapter, chapter_id: v.chapter_id };
      }
      const s = p.session_id ? data.sessions.find((x) => x.id === p.session_id) : null;
      return { ...p, source: p.sport ? `${p.sport} session` : 'Session', source_date: p.session_date, chapter_id: s?.chapter_id };
    }), [data.participants, data.sessions, volById]);

    const rows = useMemo(() => {
      let list = enriched;
      if (chapterFilter != null) list = list.filter((p) => p.chapter_id === chapterFilter);
      if (fChapter) list = list.filter((p) => (p.chapter || '') === fChapter);
      const needle = q.trim().toLowerCase();
      if (needle) {
        list = list.filter((p) =>
          [p.name, p.parent_name, p.parent_contact, p.coach, p.chapter].some((v) => (v || '').toLowerCase().includes(needle)));
      }
      const dir = sort.dir === 'desc' ? -1 : 1;
      const key = {
        name: (p) => (p.name || '').toLowerCase(),
        added: (p) => p.created_at || '',
        date: (p) => p.source_date || '',
      }[sort.col];
      return [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
    }, [enriched, q, fChapter, sort, chapterFilter]);

    const chapterNames = [...new Set(enriched.map((p) => p.chapter).filter(Boolean))].sort();
    const withContact = rows.filter((p) => p.parent_contact).length;

    const exportCsv = () => {
      TS.exportCsv('participants.csv',
        ['Name', 'Parent', 'Contact', 'Logged at', 'Date', 'Coach', 'Chapter'],
        rows.map((p) => [p.name, p.parent_name, p.parent_contact, p.source, p.source_date, p.coach, p.chapter]));
      toast(`Exported ${rows.length} participant${rows.length === 1 ? '' : 's'}`);
    };

    return (
      <div className="view">
        <PageHead icon="contact" eyebrow="Program" title="Participants"
          lede="Every kid and family contact your coaches have logged — your outreach list for programs and updates."
          actions={<Btn icon="download" onClick={exportCsv}>Export CSV</Btn>} />

        <div className="ts-filterbar">
          <div className="ts-filterbar-search">
            <Ic name="search" size={15} />
            <input value={q} placeholder="Search kids, parents, contact info…" onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ts-filter-field">
            <Select value={fChapter} onChange={(e) => setFChapter(e.target.value)}>
              <option value="">All chapters</option>
              {chapterNames.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          {(q || fChapter) && (
            <button className="ts-clear" onClick={() => { setQ(''); setFChapter(''); }}>
              <Ic name="x" size={13} /> Clear
            </button>
          )}
          <span className="ts-filter-meta"><strong>{rows.length}</strong> participants · <strong>{withContact}</strong> with contact info</span>
        </div>

        <section className="ts-card ts-tablecard">
          <div className="ts-table ts-table--parts">
            <div className="ts-tr ts-tr--parts ts-tr--head">
              <SortHead label="Participant" col="name" sort={sort} setSort={setSort} />
              <span>Parent</span>
              <span>Contact</span>
              <SortHead label="Logged at" col="date" sort={sort} setSort={setSort} />
              <span>Coach</span>
              <span>Chapter</span>
            </div>
            {rows.length === 0 && (
              <div className="ts-table-empty">
                <Empty icon="contact" title={q || fChapter ? 'Nothing matches those filters' : 'No participants yet'}
                       body={q || fChapter ? 'Try widening your search.' : 'When coaches log kids’ contact info with a session, they’ll appear here.'} />
              </div>
            )}
            {rows.map((p) => (
              <div className="ts-tr ts-tr--parts" key={p.id}>
                <span className="ts-coach"><Avatar name={p.name} size={28} /><span style={{ fontWeight: 600 }}>{p.name}</span></span>
                <span className="ts-td-loc">{p.parent_name || '—'}</span>
                <span className="ts-td-loc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.parent_contact || '—'}</span>
                <span>
                  <Tag sm bg={p.volunteer_log_id ? 'var(--accent-soft)' : 'var(--peach-soft)'} fg={p.volunteer_log_id ? 'var(--accent-deep)' : '#8A4A12'}>{p.source}</Tag>
                  <span className="ts-td-sub" style={{ marginLeft: 7 }}>{TS.fmtDate(p.source_date)}</span>
                </span>
                <span className="ts-td-loc">{p.coach || '—'}</span>
                <span className="ts-td-loc">{p.chapter ? `${TS.flag(p.chapter)} ${p.chapter}` : '—'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  };

  TS.views.participants = Participants;
})();
