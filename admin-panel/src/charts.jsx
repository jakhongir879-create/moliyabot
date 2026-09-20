import { useEffect, useState } from "react";
import { PALETTE, fmtCompact, fmtMoney } from "./format";

// 7.1 mln -> 8 mln, 320 ming -> 400 ming (o'qdagi sonlar chiroyli chiqishi uchun)
function niceCeil(value) {
  const p = 10 ** Math.floor(Math.log10(value));
  const n = value / p;
  const step = [1, 2, 3, 4, 5, 6, 8, 10].find((s) => n <= s) || 10;
  return step * p;
}

// Kirim / chiqim ustunli diagramma (chiziqlar bilan)
export function BarChart({ data, currency = "UZS", height = 220 }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [data]);

  const rawMax = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const max = niceCeil(rawMax);
  const ticks = [max, max / 2, 0];
  const every = data.length > 24 ? 3 : data.length > 14 ? 2 : 1;
  const current = sel !== null ? data[sel] : null;

  return (
    <div className="chart">
      <div className="chart-plot" style={{ height }}>
        <div className="chart-grid">
          {ticks.map((t) => (
            <div key={t} className="chart-line"><span>{fmtCompact(t)}</span></div>
          ))}
        </div>
        <div className="bars">
          {data.map((d, i) => (
            <button key={d.key} className={`bar-col ${sel === i ? "sel" : ""}`} onClick={() => setSel(sel === i ? null : i)} title={`${d.label}: +${fmtCompact(d.income)} / −${fmtCompact(d.expense)}`}>
              <span className="bar-pair">
                <span className="bar inc" style={{ height: `${Math.max((d.income / max) * 100, d.income ? 1.5 : 0)}%` }} />
                <span className="bar exp" style={{ height: `${Math.max((d.expense / max) * 100, d.expense ? 1.5 : 0)}%` }} />
              </span>
              <span className="bar-lbl">{i % every === 0 ? d.label : ""}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="chart-info">
        {current ? (
          <>
            <b>{current.label}</b>
            <span className="pos">Kirim {fmtMoney(current.income, currency)}</span>
            <span className="neg">Chiqim {fmtMoney(current.expense, currency)}</span>
          </>
        ) : (
          <>
            <span className="legend-dot inc" /> Kirim
            <span className="legend-dot exp" /> Chiqim
            <span className="muted">· ustunni bossangiz, aniq summalar ko'rinadi</span>
          </>
        )}
      </div>
    </div>
  );
}

export function Donut({ items, total, label = "Jami" }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" width="170" height="170" role="img">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#eef0f4" strokeWidth="13" />
        {items.map((it, i) => {
          const len = total ? (it.total / total) * C : 0;
          const gap = items.length > 1 ? Math.min(1.6, len * 0.3) : 0;
          const el = (
            <circle key={it.id ?? i} cx="50" cy="50" r={R} fill="none" stroke={it.color || PALETTE[i % PALETTE.length]} strokeWidth="13" strokeDasharray={`${Math.max(len - gap, 0)} ${C - Math.max(len - gap, 0)}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />
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
