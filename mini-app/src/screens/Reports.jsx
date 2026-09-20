import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet } from "lucide-react";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useAction } from "../lib/hooks";
import { api } from "../lib/api";
import { Chip, EmptyState, ErrorBox, Segmented, Skeleton, cx } from "../ui/common";
import { BarChart, Donut } from "../ui/charts";
import { PALETTE, REPORT_PERIODS } from "../lib/constants";
import { fmtMoney, fmtYmd } from "../lib/format";

function Change({ pct, goodWhenUp = true }) {
  if (pct === null || pct === undefined) return <span className="chg neutral">yangi</span>;
  if (pct === 0) return <span className="chg neutral">0%</span>;
  const up = pct > 0;
  const good = up === goodWhenUp;
  return <span className={cx("chg", good ? "good" : "bad")}>{up ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

export default function Reports() {
  const { currencies } = useApp();
  const ui = useUI();
  const run = useAction();

  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState({ from: "", to: "" });
  const [currency, setCurrency] = useState(null);
  const [catTab, setCatTab] = useState("expense");
  const [showAll, setShowAll] = useState(false);
  const [sending, setSending] = useState(false);

  const enabled = period !== "custom" || Boolean(range.from && range.to);
  const params = { period, ...(period === "custom" ? range : {}) };

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["report", params],
    queryFn: () => api("/reports", { params }),
    enabled,
    placeholderData: keepPreviousData,
  });

  const codes = data?.currencies || currencies;
  useEffect(() => {
    if (!codes.length) return;
    if (!currency || !codes.includes(currency)) setCurrency(codes[0]);
  }, [codes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = data && currency ? data.data[currency] : null;
  const cats = d ? d.byCategory[catTab] : [];
  const visibleCats = showAll ? cats : cats.slice(0, 6);

  // Halqada eng katta 6 ta toifa alohida, qolganlari bitta kulrang bo'lak
  const donutItems = useMemo(() => {
    if (cats.length <= 6) return cats;
    const rest = cats.slice(6);
    return [...cats.slice(0, 6), { id: "rest", name: "Boshqalar", total: rest.reduce((s, c) => s + c.total, 0), color: PALETTE[7] }];
  }, [cats]);
  const colorOf = (i) => (i < 6 ? PALETTE[i] : PALETTE[7]);

  const pickPeriod = (value) => {
    if (value === "custom") {
      ui.open("range", {
        from: range.from,
        to: range.to,
        onApply: (from, to) => {
          setRange({ from, to });
          setPeriod("custom");
        },
      });
    } else {
      setPeriod(value);
    }
    setShowAll(false);
  };

  const sendExcel = async () => {
    setSending(true);
    try {
      await run(() => api("/reports/export", { method: "POST", body: params }), {
        success: "Excel fayl Telegram chatingizga yuborildi ✅",
      });
    } catch {
      /* xabar ko'rsatilgan */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="screen">
      <h1 className="page-title">Hisobotlar</h1>

      <div className="chip-scroll">
        {REPORT_PERIODS.map((p) => (
          <Chip key={p.value} active={period === p.value} onClick={() => pickPeriod(p.value)}>
            {p.value === "custom" && period === "custom" && range.from ? `${fmtYmd(range.from, { year: false })} – ${fmtYmd(range.to, { year: false })}` : p.label}
          </Chip>
        ))}
      </div>

      {codes.length > 1 ? (
        <div style={{ marginTop: 12 }}>
          <Segmented small options={codes.map((c) => ({ value: c, label: c }))} value={currency} onChange={setCurrency} />
        </div>
      ) : null}

      {!enabled ? (
        <EmptyState icon="📅" title="Sana oralig'ini tanlang" />
      ) : isPending && !data ? (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          <Skeleton h={130} r={22} />
          <Skeleton h={200} r={18} />
        </div>
      ) : error && !data ? (
        <ErrorBox error={error} onRetry={refetch} />
      ) : d ? (
        <div className={cx("report-body", isFetching && "fetching")}>
          <div className="range-label">{data.range.label}</div>

          <section className="profit-card">
            <div className="profit-top">
              <span>Sof foyda</span>
              <Change pct={d.change.profit} />
            </div>
            <div className={cx("profit-amount num", d.profit < 0 && "neg")}>{fmtMoney(d.profit, currency, { sign: true })}</div>
            <div className="profit-split">
              <div>
                <span className="hero-lbl"><ArrowDownLeft size={14} /> Kirim</span>
                <b className="num">{fmtMoney(d.income, currency)}</b>
                <Change pct={d.change.income} />
              </div>
              <div>
                <span className="hero-lbl"><ArrowUpRight size={14} /> Chiqim</span>
                <b className="num">{fmtMoney(d.expense, currency)}</b>
                <Change pct={d.change.expense} goodWhenUp={false} />
              </div>
            </div>
            <div className="compare-note">{data.range.compareLabel}</div>
          </section>

          {d.count === 0 ? (
            <EmptyState icon="📭" title="Bu davrda operatsiya yo'q" text="Boshqa davrni tanlab ko'ring." />
          ) : (
            <>
              {d.series.length > 1 ? (
                <div className="card pad">
                  <div className="card-title">Dinamika</div>
                  <BarChart data={d.series} currency={currency} />
                </div>
              ) : null}

              <div className="card pad">
                <div className="card-title-row">
                  <div className="card-title">Toifalar bo'yicha</div>
                  <Segmented
                    small
                    options={[
                      { value: "expense", label: "Chiqim", tone: "expense" },
                      { value: "income", label: "Kirim", tone: "income" },
                    ]}
                    value={catTab}
                    onChange={(v) => { setCatTab(v); setShowAll(false); }}
                  />
                </div>

                {cats.length ? (
                  <>
                    <div className="donut-wrap">
                      <Donut items={donutItems} total={catTab === "expense" ? d.expense : d.income} currency={currency} label={catTab === "expense" ? "Chiqim" : "Kirim"} />
                    </div>
                    <div className="cat-list">
                      {visibleCats.map((c, i) => (
                        <div className="cat-item" key={c.id}>
                          <div className="cat-item-top">
                            <span className="dot" style={{ background: colorOf(i) }} />
                            <span className="cat-item-name">{c.icon} {c.name}</span>
                            <b className="num">{fmtMoney(c.total, currency)}</b>
                          </div>
                          <div className="cat-item-bar">
                            <span style={{ width: `${c.percent}%`, background: colorOf(i) }} />
                            <em>{c.percent}%</em>
                          </div>
                        </div>
                      ))}
                    </div>
                    {cats.length > 6 ? (
                      <button className="link-btn center-btn" onClick={() => setShowAll(!showAll)}>
                        {showAll ? "Kamroq ko'rsatish" : `Yana ${cats.length - 6} ta toifa`}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="muted center" style={{ padding: 16 }}>Bu davrda {catTab === "expense" ? "chiqim" : "kirim"} yo'q</div>
                )}
              </div>

              {d.excluded.income || d.excluded.expense ? (
                <div className="notice info">
                  ℹ️ Qarz asosiy summasi harakati foydaga kiritilmagan: <b>+{fmtMoney(d.excluded.income, currency)}</b> / <b>−{fmtMoney(d.excluded.expense, currency)}</b>
                </div>
              ) : null}
            </>
          )}

          <button className="btn btn-soft btn-block" disabled={sending} onClick={sendExcel}>
            <FileSpreadsheet size={18} /> {sending ? "Yuborilmoqda..." : "Excel faylni Telegram'ga yuborish"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
