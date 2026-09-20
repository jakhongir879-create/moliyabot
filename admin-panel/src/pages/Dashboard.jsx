import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "../api";
import { BarChart, Donut } from "../charts";
import { Avatar, Badge, Card, EmptyState, ErrorBox, MoneyList, Spinner, Stat, Tabs, cx } from "../ui";
import { PALETTE, dueInfo, fmtDateTime, fmtMoney, fmtNumber } from "../format";
import TxModal from "./TxModal";
import { TxTable } from "./Transactions";

const zero = { income: 0, expense: 0, profit: 0 };

export default function Dashboard() {
  const [currency, setCurrency] = useState(null);
  const [newTx, setNewTx] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard", 30],
    queryFn: () => api("/dashboard", { params: { days: 30 } }),
    refetchInterval: 15_000,
  });
  const system = useQuery({ queryKey: ["system"], queryFn: () => api("/system"), refetchInterval: 10_000 });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;

  const cur = currency && data.currencies.includes(currency) ? currency : data.primaryCurrency;
  const multi = data.currencies.length > 1;
  const today = data.today[cur] || zero;
  const yesterday = data.yesterday[cur] || zero;
  const month = data.month.current[cur] || zero;
  const prevMonth = data.month.previous[cur] || zero;
  const series = data.series[cur] || [];
  const top = data.topExpenses[cur] || [];
  const topTotal = top.reduce((s, c) => s + c.total, 0);
  const debts = data.debts;
  const sys = system.data;

  return (
    <>
      <div className="page-actions">
        {multi ? <Tabs options={data.currencies.map((c) => ({ value: c, label: c }))} value={cur} onChange={setCurrency} /> : <span />}
        <button className="btn btn-primary" onClick={() => setNewTx(true)}><Plus size={17} /> Yangi operatsiya</button>
      </div>

      <div className="stats">
        <Stat
          label="Umumiy balans"
          value={multi ? `≈ ${fmtMoney(data.balances.totalUZS, "UZS")}` : fmtMoney(data.balances.byCurrency[cur] || 0, cur)}
          sub={multi ? Object.entries(data.balances.byCurrency).map(([c, v]) => fmtMoney(v, c)).join("  ·  ") : `${data.accounts.length} ta hisob`}
          icon="💰"
        />
        <Stat label="Bugun kirim" value={fmtMoney(today.income, cur)} sub={`Kecha: ${fmtMoney(yesterday.income, cur)}`} tone="pos" icon="📥" />
        <Stat label="Bugun chiqim" value={fmtMoney(today.expense, cur)} sub={`Kecha: ${fmtMoney(yesterday.expense, cur)}`} tone="neg" icon="📤" />
        <Stat
          label="Shu oy foydasi"
          value={fmtMoney(month.profit, cur, { sign: true })}
          sub={`O'tgan oy: ${fmtMoney(prevMonth.profit, cur, { sign: true })}`}
          tone={month.profit >= 0 ? "pos" : "neg"}
          icon="📈"
        />
      </div>

      <div className="grid-2-1">
        <Card title="So'nggi 30 kun">
          {series.some((d) => d.income || d.expense) ? <BarChart data={series} currency={cur} /> : <EmptyState icon="📊" title="Ma'lumot yo'q" text="Operatsiyalar qo'shilgach, grafik shu yerda paydo bo'ladi." />}
        </Card>
        <Card title="Shu oy eng katta chiqimlar">
          {top.length ? (
            <div className="donut-block">
              <Donut items={top} total={topTotal} label="Chiqim" />
              <div className="legend-list">
                {top.map((c, i) => (
                  <div key={c.id} className="legend-row">
                    <i className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="grow">{c.icon} {c.name}</span>
                    <b className="num">{fmtNumber(c.total)}</b>
                    <em>{c.percent}%</em>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon="🧾" title="Chiqim yo'q" />
          )}
        </Card>
      </div>

      <div className="grid-2-1">
        <Card title="Oxirgi operatsiyalar" action={<Link className="link-btn" to="/transactions">Barchasi →</Link>} pad={false}>
          {data.recent.length ? <TxTable items={data.recent} compact /> : <EmptyState icon="🧾" title="Hali operatsiya yo'q" />}
        </Card>

        <div className="stack">
          <Card title="Qarzlar" action={<Link className="link-btn" to="/debts">Ochish →</Link>}>
            <div className="kv">
              <div className="kv-row"><span>📥 Menga qarzdor ({debts.counts.RECEIVABLE})</span><b className="pos"><MoneyList byCurrency={debts.totals.RECEIVABLE} /></b></div>
              <div className="kv-row"><span>📤 Men qarzdorman ({debts.counts.PAYABLE})</span><b className="neg"><MoneyList byCurrency={debts.totals.PAYABLE} /></b></div>
              <div className="kv-row"><span>⚠️ Muddati o'tgan</span><b>{debts.overdue} ta</b></div>
            </div>
            {debts.dueSoon.length ? (
              <div className="due-list">
                {debts.dueSoon.slice(0, 4).map((d) => {
                  const due = dueInfo({ status: "OPEN", dueInDays: d.dueInDays });
                  return (
                    <div className="due-row" key={d.id}>
                      <Avatar name={d.personName} size={30} />
                      <span className="grow">{d.personName}<small>{d.type === "RECEIVABLE" ? "sizga to'laydi" : "siz to'laysiz"}</small></span>
                      <span className="num">{fmtMoney(d.remaining, d.currency)}</span>
                      <Badge tone={due.tone}>{due.text}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>

          <Card title="Tizim holati">
            <div className="sys-list">
              <div className="sys-row"><i className={cx("dot", sys?.bot?.online ? "on" : "off")} /><span>Telegram bot</span><b>{sys?.bot?.online ? `@${sys.bot.username}` : "ulanmagan"}</b></div>
              <div className="sys-row"><i className={cx("dot", sys?.webApp?.url ? "on" : "warn")} /><span>Mini App (tunnel)</span><b>{sys?.webApp?.url ? "ulangan" : "kutilmoqda"}</b></div>
              <div className="sys-row"><i className={cx("dot", sys?.database?.ok ? "on" : "off")} /><span>Baza (Neon)</span><b>{sys?.database?.ok ? "ishlayapti" : "xato"}</b></div>
              <div className="sys-row"><i className={cx("dot", sys?.counts?.pendingUsers ? "warn" : "on")} /><span>Yangi so'rovlar</span><b>{sys?.counts?.pendingUsers ? <Link className="link-btn" to="/users">{sys.counts.pendingUsers} ta</Link> : "yo'q"}</b></div>
            </div>
            {sys && !sys.webApp.url ? (
              <p className="hint">Mini App manzili hali ulanmagan. Tunnel ochilishini 10-20 soniya kuting; ochilmasa README.md dagi «Mini App uchun internet manzili» bo'limiga qarang.</p>
            ) : null}
            {sys && !sys.owner.exists ? (
              <p className="hint">Egasi belgilanmagan. Botga <code>/start {sys.owner.setupCode}</code> yuboring.</p>
            ) : null}
          </Card>
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 6 }}>Ma'lumotlar har 15 soniyada avtomatik yangilanadi · {fmtDateTime(new Date().toISOString())}</p>

      {newTx ? <TxModal onClose={() => setNewTx(false)} /> : null}
    </>
  );
}
