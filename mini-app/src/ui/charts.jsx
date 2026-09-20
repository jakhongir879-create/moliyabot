import { useEffect, useState } from "react";
import { PALETTE } from "../lib/constants";
import { fmtCompact, fmtMoney } from "../lib/format";

// Kirim / chiqim ustunli diagramma. Ustunni bossangiz, qiymatlari pastda ko'rinadi.
export function BarChart({ data, currency = "UZS", height = 150 }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [data]);

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const every = data.length > 20 ? 4 : data.length > 12 ? 2 : 1;
  const current = sel !== null ? data[sel] : null;

  return (
    <div className="chart">
      <div className="bars" style={{ height }}>
        {data.map((d, i) => (
          <button key={d.key} className={`bar-col ${sel === i ? "sel" : ""}`} onClick={() => setSel(sel === i ? null : i)}>
            <span className="bar-pair">
              <span className="bar inc" style={{ height: `${Math.max((d.income / max) * 100, d.income ? 3 : 0)}%` }} />
              <span className="bar exp" style={{ height: `${Math.max((d.expense / max) * 100, d.expense ? 3 : 0)}%` }} />
            </span>
            <span className="bar-lbl">{i % every === 0 || i === data.length - 1 ? d.label : ""}</span>
          </button>
        ))}
      </div>
      <div className="chart-info">
        {current ? (
          <>
            <b>{current.label}</b>
            <span className="pos">Kirim {fmtCompact(current.income)}</span>
            <span className="neg">Chiqim {fmtCompact(current.expense)}</span>
          </>
        ) : (
          <>
            <span className="legend-dot inc" /> Kirim <span className="legend-dot exp" /> Chiqim
            <span className="muted"> · eng yuqori: {fmtMoney(max, currency)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Toifalar ulushi (halqa diagramma)
export function Donut({ items, total, currency = "UZS", label = "Jami" }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width="150" height="150" role="img" aria-label="Toifalar bo'yicha ulush">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg-muted)" strokeWidth="13" />
        {items.map((it, i) => {
          const len = total ? (it.total / total) * C : 0;
          const gap = items.length > 1 ? Math.min(1.6, len * 0.3) : 0;
          const el = (
            <circle
              key={it.id ?? i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={it.color || PALETTE[i % PALETTE.length]}
              strokeWidth="13"
              strokeDasharray={`${Math.max(len - gap, 0)} ${C - Math.max(len - gap, 0)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        <span>{label}</span>
        <b className="num">{fmtCompact(total)}</b>
      </div>
    </div>
  );
}
