import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, RefreshCw, X } from "lucide-react";
import { CURRENCIES, fmtMoney, groupInput } from "./format";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

// ---------------------------------------------------------------
// Toast va tasdiqlash oynasi
// ---------------------------------------------------------------
const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, tone = "default") => {
    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);
  const answer = (value) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast: showToast, confirm }), [showToast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}
      {toast ? (
        <div className={cx("toast", `toast-${toast.tone}`)} key={toast.key} role="status">
          {toast.tone === "success" ? <Check size={17} /> : toast.tone === "error" ? <X size={17} /> : null}
          {toast.message}
        </div>
      ) : null}
      {dialog ? (
        <Modal
          title={dialog.title}
          size="sm"
          onClose={() => answer(false)}
          footer={
            <>
              <button className="btn" onClick={() => answer(false)}>Bekor qilish</button>
              <button className={cx("btn", dialog.danger ? "btn-danger" : "btn-primary")} onClick={() => answer(true)}>
                {dialog.confirmText || "Ha"}
              </button>
            </>
          }
        >
          <p className="dialog-text">{dialog.message}</p>
        </Modal>
      ) : null}
    </UIContext.Provider>
  );
}

// ---------------------------------------------------------------
// Modal
// ---------------------------------------------------------------
export function Modal({ title, children, footer, onClose, size = "md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={cx("modal", `modal-${size}`)} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Kichik komponentlar
// ---------------------------------------------------------------
export function Badge({ tone = "neutral", children }) {
  return <span className={cx("badge", `badge-${tone}`)}>{children}</span>;
}

export function Card({ title, action, children, pad = true, className }) {
  return (
    <section className={cx("card", className)}>
      {title || action ? (
        <header className="card-head">
          <h2>{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={pad ? "card-body" : undefined}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone, icon }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <div className={cx("stat-value num", tone)}>{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("field", className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={cx("tab", value === o.value && "active")} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined ? <em>{o.count}</em> : null}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <button role="switch" aria-checked={checked} disabled={disabled} className={cx("switch", checked && "on")} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Spinner({ label = "Yuklanmoqda..." }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "🗂️", title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {text ? <div className="empty-text">{text}</div> : null}
      {action}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="error-box">
      <AlertTriangle size={20} />
      <div>{error?.message || "Xatolik yuz berdi"}</div>
      {onRetry ? (
        <button className="btn btn-sm" onClick={onRetry}>
          <RefreshCw size={14} /> Qayta urinish
        </button>
      ) : null}
    </div>
  );
}

export function Avatar({ name = "?", size = 34 }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 70% 93%)`, color: `hsl(${hue} 55% 32%)` }}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const nums = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div className="pagination">
      <span className="muted">{from}–{to} / {total}</span>
      <div className="pager">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Oldingi</button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`d${i}`} className="muted">…</span>
          ) : (
            <button key={n} className={cx("btn btn-sm", n === page && "btn-primary")} onClick={() => onChange(n)}>{n}</button>
          )
        )}
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Keyingi</button>
      </div>
    </div>
  );
}

export function AmountField({ value, onChange, currency = "UZS", autoFocus, placeholder = "0" }) {
  const cur = CURRENCIES[currency] || { symbol: currency };
  return (
    <div className="amount-field">
      <input className="input" inputMode="decimal" autoFocus={autoFocus} placeholder={placeholder} value={value} onChange={(e) => onChange(groupInput(e.target.value))} />
      <span>{cur.symbol}</span>
    </div>
  );
}

export function MoneyList({ byCurrency, sign, className }) {
  const entries = Object.entries(byCurrency || {}).filter(([, v]) => v);
  if (!entries.length) return <span className={className}>{fmtMoney(0, "UZS")}</span>;
  return (
    <span className={className}>
      {entries.map(([c, v], i) => (
        <span key={c}>{i ? " + " : ""}{fmtMoney(v, c, { sign })}</span>
      ))}
    </span>
  );
}
