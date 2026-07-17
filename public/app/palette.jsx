/* palette.jsx — ⌘K command palette: navigation, actions, coach jump. */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useRef, useMemo } = React;
  const { Ic } = TS.ui;

  const Palette = ({ open, onClose, coaches, onNav, onAction }) => {
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
      if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); }
    }, [open]);

    const items = useMemo(() => {
      const nav = TS.NAV.flatMap((g) => g.items).map((it) => ({
        group: 'Go to', icon: it.icon, label: it.label, sub: 'View',
        run: () => onNav(it.id),
      }));
      const actions = [
        { group: 'Actions', icon: 'calendar-plus', label: 'Log a session', sub: 'N', run: () => onNav('add') },
        { group: 'Actions', icon: 'download', label: 'Export sessions CSV', sub: 'Download', run: () => onAction('export-sessions') },
        { group: 'Actions', icon: 'download', label: 'Export volunteer logs CSV', sub: 'Download', run: () => onAction('export-volunteer') },
        { group: 'Actions', icon: 'upload', label: 'Upload a photo', sub: 'Gallery', run: () => onAction('upload-photo') },
        { group: 'Actions', icon: 'external', label: 'Open public impact page', sub: 'impact.html', run: () => window.open('/impact.html', '_blank') },
        { group: 'Actions', icon: 'external', label: 'Open coach portal', sub: 'coach.html', run: () => window.open('/coach.html', '_blank') },
        { group: 'Actions', icon: 'logout', label: 'Sign out', sub: '', run: () => onAction('logout') },
      ];
      const coachItems = (coaches || [])
        .filter((c) => c.name !== 'Coach TBD')
        .map((c) => ({
          group: 'Coaches', icon: 'whistle', label: c.name,
          sub: [c.chapter, c.sport].filter(Boolean).join(' · '),
          run: () => onAction('open-coach', c),
        }));
      const all = [...nav, ...actions, ...coachItems];
      const needle = q.trim().toLowerCase();
      if (!needle) return all.slice(0, 14);
      return all.filter((it) =>
        it.label.toLowerCase().includes(needle) || (it.sub || '').toLowerCase().includes(needle)
      ).slice(0, 14);
    }, [q, coaches, onNav, onAction]);

    useEffect(() => { setSel(0); }, [q]);

    useEffect(() => {
      if (!open) return;
      const h = (e) => {
        if (e.key === 'Escape') { onClose(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
        else if (e.key === 'Enter') {
          e.preventDefault();
          const it = items[sel];
          if (it) { it.run(); onClose(); }
        }
      };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [open, items, sel, onClose]);

    useEffect(() => {
      listRef.current?.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest' });
    }, [sel]);

    if (!open) return null;

    let lastGroup = null;
    return (
      <div className="ts-pal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ts-pal" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="ts-pal-inputrow">
            <Ic name="search" size={17} />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Search views, actions, coaches…" />
            <span className="ui-kbd">esc</span>
          </div>
          <div className="ts-pal-list" ref={listRef}>
            {items.length === 0 && <div className="ts-pal-empty">No matches for “{q}”.</div>}
            {items.map((it, i) => {
              const showGroup = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <React.Fragment key={`${it.group}-${it.label}`}>
                  {showGroup && <div className="ts-pal-group">{it.group}</div>}
                  <button className={`ts-pal-item${i === sel ? ' is-sel' : ''}`}
                          onMouseEnter={() => setSel(i)}
                          onClick={() => { it.run(); onClose(); }}>
                    <Ic name={it.icon} size={16} />
                    <span className="ts-pal-label">{it.label}</span>
                    {it.sub && <span className="ts-pal-sub">{it.sub}</span>}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <div className="ts-pal-foot">
            <span><b>↑↓</b> navigate</span>
            <span><b>↵</b> select</span>
            <span><b>esc</b> close</span>
          </div>
        </div>
      </div>
    );
  };

  TS.Palette = Palette;
})();
