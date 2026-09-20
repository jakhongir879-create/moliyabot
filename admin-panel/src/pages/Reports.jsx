import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, downloadFile } from "../api";
import { BarChart, Donut } from "../charts";
import { Card, EmptyState, ErrorBox, Spinner, Stat, Tabs, cx, useUI } from "../ui";
import { PALETTE, fmtMoney } from "../format";

const PERIODS = [
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Shu hafta"],
  ["month", "Shu oy"],
  ["lastMonth", "O'tgan oy"],
  ["year", "Shu yil"],
  ["custom", "Sana oralig'i"],
];

function Change({ pct, goodWhenUp = true }) {
  if (pct === null || pct === undefined) return <span className="chg neutral">yangi</span>;
  if (pct === 0) return <span className="chg neutral">0%</span>;
  const up = pct > 0;
  return <span className={cx("chg", up === goodWhenUp ? "good" : "bad")}>{up ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

function CategoryTable({ title, items, currency, total }) {
  return (
    <Card title={title} pad={false}>
      {items.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Toifa</th><th className="right">Soni</th><th className="right">Summa</th><th style={{ width: "34%" }}>Ulush</th></tr></thead>
            <tbody>
              {items.map((c, i) => (
                <tr key={c.id}>
                  <td>{c.icon} {c.name}</td>
                  <td className="right num muted">{c.count}</td>
                  <td className="right num strong">{fmtMoney(c.total, currency)}</td>
                  <td>
                    <div className="bar-cell">
                      <span style={{ width: `${c.percent}%`, background: PALETTE[i % PALETTE.length] }} />
                      <em>{c.percent}%</em>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Jami</td><td /><td className="right num strong">{fmtMoney(total, currency)}</td><td /></tr></tfoot>
          </table>
        </div>
      ) : (
        <EmptyState icon="📭" title="Ma'lumot yo'q" />
      )}
    </Card>
  );
}

export default function Reports() {
  const ui = useUI();
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState({ from: "", to: "" });
  const [currency, setCurrency] = useState(null);
  const [exporting, setExporting] = useState(false);

  const enabled = period !== "custom" || Boolean(range.from && range.to);
  const params = { period, ...(period === "custom" ? range : {}) };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["report", params],
    queryFn: () => api("/reports", { params }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const codes = data?.currencies || [];
  useEffect(() => {
    if (codes.length && (!currency || !codes.includes(currency))) setCurrency(codes[0]);
  }, [codes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data && currency ? data.data[currency] : null;

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadFile("/export", params);
      ui.toast("Excel fayl yuklab olindi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="page-actions">
        <div className="row-gap wrap">
          <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {period === "custom" ? (
            <>
              <input className="input" type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <input className="input" type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </>
          ) : null}
          {codes.length > 1 ? <Tabs options={codes.map((c) => ({ value: c, label: c }))} value={currency} onChange={setCurrency} /> : null}
        </div>
        <button className="btn" onClick={exportExcel} disabled={exporting || !enabled}><Download size={16} /> {exporting ? "Tayyorlanmoqda..." : "Excel yuklab olish"}</button>
      </div>

      {!enabled ? (
        <Card><EmptyState icon="📅" title="Sana oralig'ini tanlang" /></Card>
      ) : isLoading && !data ? (
        <Spinner />
      ) : error && !data ? (
        <ErrorBox error={error} onRetry={refetch} />
      ) : d ? (
        <div className={cx("stack", isFetching && "fetching")}>
          <div className="range-title">{data.range.label} <span className="muted">· foizlar {data.range.compareLabel}</span></div>

          <div className="stats three">
            <Stat label="Kirim" value={fmtMoney(d.income, currency)} tone="pos" icon="📥" sub={<Change pct={d.change.income} />} />
            <Stat label="Chiqim" value={fmtMoney(d.expense, currency)} tone="neg" icon="📤" sub={<Change pct={d.change.expense} goodWhenUp={false} />} />
            <Stat label="Sof foyda" value={fmtMoney(d.profit, currency, { sign: true })} tone={d.profit >= 0 ? "pos" : "neg"} icon="📈" sub={<Change pct={d.change.profit} />} />
          </div>

          {d.excluded.income || d.excluded.expense ? (
            <div className="notice">ℹ️ Qarz asosiy summasi harakati foydaga kiritilmagan: <b>+{fmtMoney(d.excluded.income, currency)}</b> / <b>−{fmtMoney(d.excluded.expense, currency)}</b></div>
          ) : null}

          {d.count === 0 ? (
            <Card><EmptyState icon="📭" title="Bu davrda operatsiya yo'q" text="Boshqa davrni tanlab ko'ring." /></Card>
          ) : (
            <>
              {d.series.length > 1 ? <Card title="Dinamika"><BarChart data={d.series} currency={currency} /></Card> : null}
              <div className="grid-2">
                <div className="stack">
                  {d.byCategory.expense.length ? (
                    <Card title="Chiqimlar ulushi">
                      <div className="donut-block">
                        <Donut items={d.byCategory.expense.slice(0, 8)} total={d.expense} label="Chiqim" />
                        <div className="legend-list">
                          {d.byCategory.expense.slice(0, 8).map((c, i) => (
                            <div key={c.id} className="legend-row"><i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="grow">{c.icon} {c.name}</span><em>{c.percent}%</em></div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ) : null}
                  <CategoryTable title="Chiqim toifalari" items={d.byCategory.expense} currency={currency} total={d.expense} />
                </div>
                <div className="stack">
                  {d.byCategory.income.length ? (
                    <Card title="Kirimlar ulushi">
                      <div className="donut-block">
                        <Donut items={d.byCategory.income.slice(0, 8)} total={d.income} label="Kirim" />
                        <div className="legend-list">
                          {d.byCategory.income.slice(0, 8).map((c, i) => (
                            <div key={c.id} className="legend-row"><i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="grow">{c.icon} {c.name}</span><em>{c.percent}%</em></div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  ) : null}
                  <CategoryTable title="Kirim toifalari" items={d.byCategory.income} currency={currency} total={d.income} />
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
