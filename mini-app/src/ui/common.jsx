import { AlertTriangle, RefreshCw } from "lucide-react";
import { CURRENCIES, fmtMoney, groupInput } from "../lib/format";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export function Skeleton({ h = 16, w = "100%", r = 10, style }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="card-list">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="row" key={i}>
          <Skeleton h={44} w={44} r={14} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <Skeleton h={14} w="55%" />
            <Skeleton h={12} w="35%" />
          </div>
          <Skeleton h={16} w={72} />
        </div>
      ))}
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
      <AlertTriangle size={22} />
      <div>{error?.message || "Xatolik yuz berdi"}</div>
      {onRetry ? (
        <button className="btn btn-soft btn-sm" onClick={onRetry}>
          <RefreshCw size={15} /> Qayta urinish
        </button>
      ) : null}
    </div>
  );
}

export function Segmented({ options, value, onChange, small = false }) {
  return (
    <div className={cx("seg", small && "seg-sm")} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={cx("seg-item", value === o.value && "active", o.tone && `tone-${o.tone}`)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, tone }) {
  return (
    <button className={cx("chip", active && "active", tone && `tone-${tone}`)} onClick={onClick}>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx("switch", checked && "on")}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Field({ label, hint, children, right }) {
  return (
    <label className="field">
      {label ? (
        <span className="field-label">
          {label}
          {right ? <span className="field-right">{right}</span> : null}
        </span>
      ) : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={cx("badge", `badge-${tone}`)}>{children}</span>;
}

export function Avatar({ name = "?", size = 44, tone }) {
  const letter = (name.trim()[0] || "?").toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: tone || `hsl(${hue} 70% 94%)`,
        color: tone ? "#fff" : `hsl(${hue} 55% 34%)`,
      }}
    >
      {letter}
    </div>
  );
}

export function Money({ value, currency = "UZS", sign = false, className }) {
  return <span className={cx("num", className)}>{fmtMoney(value, currency, { sign })}</span>;
}

// Katta summa kiritish maydoni
export function AmountInput({ value, onChange, currency = "UZS", autoFocus = false, placeholder = "0" }) {
  const cur = CURRENCIES[currency] || { symbol: currency, position: "suffix" };
  const len = String(value || "").length;
  const size = len > 15 ? 26 : len > 12 ? 30 : len > 9 ? 36 : 44;
  const symbol = <span className="amount-sym">{cur.symbol}</span>;
  return (
    <div className="amount-input">
      {cur.position === "prefix" ? symbol : null}
      <input
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        style={{ fontSize: size, width: `${Math.max(len, 1) + 0.6}ch` }}
        onChange={(e) => onChange(groupInput(e.target.value))}
      />
      {cur.position === "suffix" ? symbol : null}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}
