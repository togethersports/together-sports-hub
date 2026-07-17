/* ui.jsx — icons + UI primitives (buttons, fields, modals, drawer, toasts). */

(() => {
  const TS = window.TS;
  const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;

  // ── Icons (24×24, stroke) ───────────────────────────────
  const P = (...ds) => ds.map((d, i) => <path key={i} d={d} />);
  const ICONS = {
    home: P('M3 10 12 3l9 7', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'),
    calendar: [<rect key="r" x="3" y="4" width="18" height="17" rx="2.5" />, ...P('M8 2v4', 'M16 2v4', 'M3 9.5h18')],
    'calendar-plus': [<rect key="r" x="3" y="4" width="18" height="17" rx="2.5" />, ...P('M8 2v4', 'M16 2v4', 'M3 9.5h18', 'M12 12.5v5', 'M9.5 15h5')],
    heart: P('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z'),
    users: [<circle key="c" cx="9.5" cy="7.5" r="3.7" />, ...P('M2.5 20.5v-1.4a5.6 5.6 0 0 1 5.6-5.6h2.8a5.6 5.6 0 0 1 5.6 5.6v1.4', 'M15.7 4.1a3.7 3.7 0 0 1 0 6.9', 'M18.5 13.7a5.6 5.6 0 0 1 3 5v1.8')],
    contact: [<rect key="r" x="3" y="3.5" width="18" height="17" rx="2.5" />, <circle key="c" cx="9.3" cy="9.8" r="2.3" />, ...P('M5.5 16.8a4.2 4.2 0 0 1 7.6 0', 'M15.5 8.5H18', 'M15.5 12.5H18')],
    whistle: [<circle key="c" cx="8.5" cy="14.5" r="5.5" />, ...P('M12.5 10.5 21 5.5v4l-6.2 2.4', 'M8.5 12v2.5')],
    medal: [<circle key="c" cx="12" cy="14.5" r="5.3" />, ...P('M8.7 10.5 5.5 3h4l2.5 5.6L14.5 3h4l-3.2 7.5', 'M12 12.5l.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z')],
    trophy: P('M8 21h8', 'M12 17v4', 'M7 4h10v6a5 5 0 0 1-10 0z', 'M7 5.5H4.5a0 0 0 0 0 0 0A3.5 3.5 0 0 0 8 9', 'M17 5.5h2.5A3.5 3.5 0 0 1 16 9'),
    image: [<rect key="r" x="3" y="4" width="18" height="16" rx="2.5" />, <circle key="c" cx="8.8" cy="9.3" r="1.6" />, ...P('M21 15.5 15.5 10 5 20')],
    'badge-check': [<circle key="c" cx="12" cy="12" r="9" />, ...P('M8.5 12.2l2.4 2.4 4.6-4.9')],
    sliders: P('M4 21v-6.5', 'M4 10.5V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-4.5', 'M20 12.5V3', 'M1.5 14.5h5', 'M9.5 8h5', 'M17.5 16.5h5'),
    search: [<circle key="c" cx="11" cy="11" r="7.5" />, ...P('M21 21l-4.7-4.7')],
    bell: P('M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8-2.5 8h17s-2.5-1.5-2.5-8', 'M10.2 20.5a2 2 0 0 0 3.6 0'),
    'chev-down': P('M6 9.5l6 6 6-6'),
    'chev-right': P('M9.5 6l6 6-6 6'),
    'chev-ud': P('M8 15l4 4.5 4-4.5', 'M8 9l4-4.5L16 9'),
    x: P('M18 6 6 18', 'M6 6l12 12'),
    plus: P('M12 5v14', 'M5 12h14'),
    edit: P('M11 4.5H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12.5a2 2 0 0 0 2-2v-6', 'M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z'),
    trash: P('M3.5 6.5h17', 'M8.5 6.5v-2a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v2', 'M19 6.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.5', 'M10 11v6', 'M14 11v6'),
    download: P('M21 15.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-3', 'M7 10.5l5 5 5-5', 'M12 15.5V3'),
    upload: P('M21 15.5v3a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-3', 'M7 8l5-5 5 5', 'M12 3v12.5'),
    pin: P('M20 10.5c0 6-8 11.5-8 11.5S4 16.5 4 10.5a8 8 0 0 1 16 0z', 'M12 13.3a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z'),
    clock: [<circle key="c" cx="12" cy="12" r="9" />, ...P('M12 6.5V12l3.5 2')],
    mail: [<rect key="r" x="2.5" y="4.5" width="19" height="15" rx="2.5" />, ...P('M21.5 7.5 12 13.5 2.5 7.5')],
    phone: P('M21.5 16.9v2.6a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 1.6 3.8a2 2 0 0 1 2-2.2h2.6a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.3 9.4a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'),
    key: P('M21 2.5l-1.7 1.7', 'M11.4 12.1a5.3 5.3 0 1 1-7.5 7.5 5.3 5.3 0 0 1 7.5-7.5zm0 0 4.1-4.1m0 0 2.9 2.9 2.6-2.6-2.9-2.9m-2.6 2.6L19.3 4.2'),
    copy: [<rect key="r" x="9" y="9" width="12.5" height="12.5" rx="2" />, ...P('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')],
    logout: P('M9 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H9', 'M16 17l5-5-5-5', 'M21 12H9'),
    alert: P('M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9.5v4', 'M12 17.2h.01'),
    sparkle: P('M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z', 'M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'),
    check: P('M20 6.5 9.5 17 4 11.5'),
    camera: P('M22.5 18.5a2 2 0 0 1-2 2h-17a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.5l2-3h6l2 3h3.5a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
    filter: P('M22 3.5H2l8 9.2v6.8l4 2v-8.8z'),
    external: P('M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5', 'M14.5 3H21v6.5', 'M10 14 21 3'),
    'arrow-right': P('M4.5 12h15', 'M13 5.5l6.5 6.5-6.5 6.5'),
    quote: P('M21 15a2 2 0 0 1-2 2H7.5L3 21.5V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
    clipboard: [<rect key="r" x="8" y="1.8" width="8" height="4" rx="1.2" />, ...P('M16 3.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2h2', 'M8.5 11.5h7', 'M8.5 15.5h7')],
    eye: [<circle key="c" cx="12" cy="12" r="3" />, ...P('M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z')],
    globe: [<circle key="c" cx="12" cy="12" r="9" />, ...P('M3 12h18', 'M12 3a14.5 14.5 0 0 1 3.8 9 14.5 14.5 0 0 1-3.8 9 14.5 14.5 0 0 1-3.8-9A14.5 14.5 0 0 1 12 3z')],
    shield: P('M12 22s8-3.8 8-9.8V5.2L12 2 4 5.2v7C4 18.2 12 22 12 22z'),
    command: P('M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'),
    sun: [<circle key="c" cx="12" cy="12" r="4.2" />, ...P('M12 1.8v2.5', 'M12 19.7v2.5', 'M4.8 4.8l1.8 1.8', 'M17.4 17.4l1.8 1.8', 'M1.8 12h2.5', 'M19.7 12h2.5', 'M4.8 19.2l1.8-1.8', 'M17.4 6.6l1.8-1.8')],
  };

  const Ic = ({ name, size = 17, style }) => (
    <svg className="ts-ic" width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={style} aria-hidden="true">
      {ICONS[name] || ICONS.sparkle}
    </svg>
  );

  // ── Small primitives ────────────────────────────────────
  const Btn = ({ kind = 'ghost', sm, full, icon, children, ...rest }) => (
    <button className={`ui-btn ui-btn--${kind}${sm ? ' ui-btn--sm' : ''}${full ? ' ui-btn--full' : ''}`} {...rest}>
      {icon && <Ic name={icon} size={15.5} />}{children}
    </button>
  );

  const IconBtn = ({ icon, danger, title, size = 16, ...rest }) => (
    <button className={`ui-iconbtn${danger ? ' is-danger' : ''}`} title={title} aria-label={title} {...rest}>
      <Ic name={icon} size={size} />
    </button>
  );

  const Kbd = ({ children }) => <span className="ui-kbd">{children}</span>;

  const Tag = ({ bg, fg, sm, children }) => (
    <span className={`ui-tag${sm ? ' ui-tag--sm' : ''}`} style={{ background: bg, color: fg }}>{children}</span>
  );

  const SportTag = ({ name, sm }) => {
    if (!name) return <span className="ts-td-loc">—</span>;
    const s = TS.sportStyle(name);
    return <Tag bg={s.bg} fg={s.fg} sm={sm}>{name}</Tag>;
  };

  const Avatar = ({ name, size = 34, fontSize }) => (
    <span className="ui-avatar" style={{
      width: size, height: size, background: TS.avatarColor(name),
      color: '#fff', fontSize: fontSize || Math.round(size * 0.36),
    }}>{TS.initials(name)}</span>
  );

  const Status = ({ on, onLabel = 'Active', offLabel = 'Inactive' }) => (
    <span className="ui-status">
      <span className="ui-status-dot" style={{ background: on ? 'var(--lime)' : '#C9CAB8' }} />
      {on ? onLabel : offLabel}
    </span>
  );

  // ── Form fields ─────────────────────────────────────────
  const Field = ({ label, req, hint, error, children, className = '' }) => (
    <div className={`ui-field ${className}`}>
      {label && <label className="ui-label">{label}{req && <span className="ui-req">*</span>}</label>}
      {children}
      {error ? <span className="ui-error">{error}</span> : hint ? <span className="ui-hint">{hint}</span> : null}
    </div>
  );

  const Input = ({ invalid, ...rest }) => (
    <input className={`ui-input${invalid ? ' is-invalid' : ''}`} {...rest} />
  );

  const Textarea = ({ invalid, ...rest }) => (
    <textarea className={`ui-input ui-textarea${invalid ? ' is-invalid' : ''}`} {...rest} />
  );

  const Select = ({ invalid, children, ...rest }) => (
    <div className={`ui-select${invalid ? ' is-invalid' : ''}`}>
      <select {...rest}>{children}</select>
      <Ic name="chev-down" size={15} />
    </div>
  );

  const Stepper = ({ value, onChange, min = 0, max = 999, step = 1, invalid }) => {
    const clamp = (n) => Math.min(max, Math.max(min, n));
    const num = Number(value) || 0;
    return (
      <div className={`ui-stepper${invalid ? ' is-invalid' : ''}`}>
        <button type="button" aria-label="decrease" onClick={() => onChange(clamp(num - step))}>−</button>
        <input value={value} inputMode="numeric"
               onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ''); onChange(v === '' ? '' : clamp(Number(v))); }} />
        <button type="button" aria-label="increase" onClick={() => onChange(clamp(num + step))}>+</button>
      </div>
    );
  };

  const Seg = ({ options, value, onChange }) => (
    <div className="ui-seg" role="tablist">
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <button key={opt.value} role="tab" aria-selected={value === opt.value}
                  className={`ui-seg-btn${value === opt.value ? ' is-active' : ''}`}
                  onClick={() => onChange(opt.value)}>{opt.label}</button>
        );
      })}
    </div>
  );

  const Toggle = ({ on, onChange, label }) => (
    <button type="button" className={`ui-toggle${on ? ' is-on' : ''}`} role="switch"
            aria-checked={!!on} aria-label={label} onClick={() => onChange(!on)}>
      <span />
    </button>
  );

  // ── Modal / Drawer ──────────────────────────────────────
  const useEsc = (onClose) => {
    useEffect(() => {
      const h = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', h);
      return () => window.removeEventListener('keydown', h);
    }, [onClose]);
  };

  const Modal = ({ title, sub, wide, onClose, children, foot }) => {
    useEsc(onClose);
    return (
      <div className="ui-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={`ui-modal${wide ? ' ui-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="ui-modal-head">
            <div>
              <h3 className="ui-modal-title">{title}</h3>
              {sub && <p className="ui-modal-sub">{sub}</p>}
            </div>
            <IconBtn icon="x" title="Close" onClick={onClose} />
          </div>
          <div className="ui-modal-body">{children}</div>
          {foot && <div className="ui-modal-foot">{foot}</div>}
        </div>
      </div>
    );
  };

  const Drawer = ({ title, sub, onClose, children, foot }) => {
    useEsc(onClose);
    return (
      <>
        <div className="ui-drawer-backdrop" onMouseDown={onClose} />
        <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
          <div className="ui-drawer-head">
            <div>
              <h3 className="ui-modal-title">{title}</h3>
              {sub && <p className="ui-modal-sub">{sub}</p>}
            </div>
            <IconBtn icon="x" title="Close" onClick={onClose} />
          </div>
          <div className="ui-drawer-body">{children}</div>
          {foot && <div className="ui-drawer-foot">{foot}</div>}
        </aside>
      </>
    );
  };

  const Confirm = ({ title = 'Are you sure?', body, confirmLabel = 'Delete', onConfirm, onClose }) => (
    <Modal title={title} onClose={onClose} foot={
      <>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn kind="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
      </>
    }>
      <p className="ts-confirm-body">{body}</p>
    </Modal>
  );

  const Empty = ({ icon = 'sparkle', title, body, action }) => (
    <div className="ui-empty">
      <div className="ui-empty-ic"><Ic name={icon} size={22} /></div>
      <div className="ui-empty-title">{title}</div>
      {body && <div className="ui-empty-body">{body}</div>}
      {action}
    </div>
  );

  const Loading = ({ label = 'Loading…' }) => (
    <div className="ts-loading"><span className="ts-spin" />{label}</div>
  );

  // ── Toasts ──────────────────────────────────────────────
  const ToastCtx = createContext(() => {});
  let toastId = 0;

  const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const push = useCallback((msg, opts = {}) => {
      const id = ++toastId;
      setToasts((t) => [...t, { id, msg, ...opts }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 4200);
    }, []);
    return (
      <ToastCtx.Provider value={push}>
        {children}
        <div className="ui-toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`ui-toast${t.error ? ' ui-toast--error' : ''}`}>
              <Ic name={t.error ? 'alert' : 'check'} size={16} />
              {t.msg}
              {t.action && (
                <button className="ui-toast-act" onClick={() => { t.action.fn(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    );
  };

  const useToast = () => useContext(ToastCtx);

  // ── Shared header block ─────────────────────────────────
  const PageHead = ({ eyebrow, icon = 'sun', title, lede, actions }) => (
    <header className="ts-pagehead">
      <div>
        <span className="ts-eyebrow"><Ic name={icon} size={13.5} />{eyebrow}</span>
        <h1 className="ts-h1">{title}</h1>
        {lede && <p className="ts-lede">{lede}</p>}
      </div>
      {actions && <div className="ts-pagehead-actions">{actions}</div>}
    </header>
  );

  const SortHead = ({ label, col, sort, setSort, num }) => {
    const active = sort.col === col;
    return (
      <button className={`ts-sorthead${num ? ' is-num' : ''}`}
              onClick={() => setSort({ col, dir: active && sort.dir === 'desc' ? 'asc' : 'desc' })}>
        {label}
        <span className={`ts-sortcaret${active ? ' is-on' : ''}`}>{active ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}</span>
      </button>
    );
  };

  TS.ui = {
    Ic, Btn, IconBtn, Kbd, Tag, SportTag, Avatar, Status,
    Field, Input, Textarea, Select, Stepper, Seg, Toggle,
    Modal, Drawer, Confirm, Empty, Loading,
    ToastProvider, useToast, PageHead, SortHead,
  };
})();
