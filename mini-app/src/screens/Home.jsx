import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Eye, EyeOff, Handshake, Minus, Plus, X } from "lucide-react";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useDashboard, useStoredState } from "../lib/hooks";
import { Avatar, Badge, EmptyState, ErrorBox, SectionTitle, Skeleton, cx } from "../ui/common";
import TxRow from "../ui/TxRow";
import { BarChart } from "../ui/charts";
import { dueInfo, fmtMoney, longToday } from "../lib/format";
import { tgUser } from "../lib/telegram";

export default function Home({ go }) {
  const { me, business } = useApp();
  const ui = useUI();
  const { data, isPending, error, refetch } = useDashboard();
  const tg = tgUser();
  const name = me?.firstName || tg?.first_name || "do'stim";

  return (
    <div className="screen">
      <header className="home-head">
        <Avatar name={name} size={46} tone="#111827" />
        <div className="home-head-main">
          <div className="home-hello">Assalomu alaykum, {name} 👋</div>
          <div className="muted small">{longToday()} · {business?.name}</div>
        </div>
      </header>

      {isPending ? (
        <HomeSkeleton />
      ) : error ? (
        <ErrorBox error={error} onRetry={refetch} />
      ) : data.staff ? (
        <StaffHome data={data} ui={ui} />
      ) : (
        <ManagerHome data={data} ui={ui} go={go} />
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={64} w={64} r={32} />)}
      </div>
      <Skeleton h={168} r={24} />
      <Skeleton h={78} r={18} />
      <Skeleton h={220} r={18} />
    </div>
  );
}

// ---------------------------------------------------------------
// Story (insight) doiralari
// ---------------------------------------------------------------
function StoryRow({ items, onOpen }) {
  const [seen, setSeen] = useStoredState("seenStories", {});
  const today = new Date().toDateString();
  const isSeen = (id) => seen[id] === today;
  if (!items?.length) return null;
  return (
    <div className="stories" role="list">
      {items.map((s, i) => (
        <button
          key={s.id}
          className={cx("story", isSeen(s.id) && "seen")}
          onClick={() => {
            setSeen((prev) => ({ ...prev, [s.id]: today }));
            onOpen(i);
          }}
        >
          <span className="story-ring"><span className="story-icon">{s.icon}</span></span>
          <span className="story-label">{s.title}</span>
        </button>
      ))}
    </div>
  );
}

function StoryViewer({ items, start, onClose }) {
  const [index, setIndex] = useState(start);
  const timer = useRef(null);
  const DURATION = 6000;

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (index < items.length - 1) setIndex(index + 1);
      else onClose();
    }, DURATION);
    return () => clearTimeout(timer.current);
  }, [index, items.length, onClose]);

  const s = items[index];
  const next = () => (index < items.length - 1 ? setIndex(index + 1) : onClose());
  const prev = () => setIndex(Math.max(0, index - 1));

  return (
    <div className={cx("story-view", `tone-${s.tone || "neutral"}`)}>
      <div className="story-bars">
        {items.map((_, i) => (
          <span key={i} className={cx("story-bar", i < index && "done", i === index && "run")}>
            <i style={i === index ? { animationDuration: `${DURATION}ms` } : undefined} />
          </span>
        ))}
      </div>
      <button className="story-close" onClick={onClose} aria-label="Yopish"><X size={24} /></button>
      <div className="story-tap left" onClick={prev} />
      <div className="story-tap right" onClick={next} />
      <div className="story-content">
        <div className="story-emoji">{s.icon}</div>
        <div className="story-title">{s.title}</div>
        <div className="story-headline num">{s.headline}</div>
        <div className="story-sub">{s.sub}</div>
        <div className="story-rows">
          {s.rows.map((r) => (
            <div className="story-row" key={r.label}>
              <span>{r.label}</span>
              <b className={cx("num", r.tone)}>{r.value}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Egasi / buxgalter uchun
// ---------------------------------------------------------------
function ManagerHome({ data, ui, go }) {
  const { accounts } = useApp();
  const [hidden, setHidden] = useStoredState("hideBalance", false);
  const [story, setStory] = useState(null);

  const primary = data.primaryCurrency;
  const today = data.today[primary] || { income: 0, expense: 0 };
  const multi = data.currencies.length > 1;
  const total = multi ? data.balances.totalUZS : data.balances.byCurrency[primary] || 0;
  const totalCur = multi ? "UZS" : primary;
  const mask = (text) => (hidden ? "••••••" : text);
  const series = data.series[primary] || [];
  const dueSoon = data.debts.dueSoon || [];

  return (
    <>
      <StoryRow items={data.insights} onOpen={setStory} />
      {story !== null ? <StoryViewer items={data.insights} start={story} onClose={() => setStory(null)} /> : null}

      <section className="hero">
        <div className="hero-top">
          <span>Umumiy balans</span>
          <button className="hero-eye" onClick={() => setHidden(!hidden)} aria-label="Balansni yashirish">
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="hero-amount num">
          {multi ? <small>≈ </small> : null}
          {mask(fmtMoney(total, totalCur))}
        </div>
        {multi ? (
          <div className="hero-chips">
            {Object.entries(data.balances.byCurrency).map(([c, v]) => (
              <span className="hero-chip num" key={c}>{mask(fmtMoney(v, c))}</span>
            ))}
          </div>
        ) : null}
        <div className="hero-split">
          <div>
            <span className="hero-lbl"><ArrowDownLeft size={14} /> Bugun kirim</span>
            <b className="num">{fmtMoney(today.income, primary)}</b>
          </div>
          <div>
            <span className="hero-lbl"><ArrowUpRight size={14} /> Bugun chiqim</span>
            <b className="num">{fmtMoney(today.expense, primary)}</b>
          </div>
        </div>
      </section>

      <section className="quick">
        <button className="quick-btn" onClick={() => ui.open("txForm", { preset: { type: "INCOME" } })}>
          <span className="quick-ic inc"><Plus size={22} /></span>Kirim
        </button>
        <button className="quick-btn" onClick={() => ui.open("txForm", { preset: { type: "EXPENSE" } })}>
          <span className="quick-ic exp"><Minus size={22} /></span>Chiqim
        </button>
        {accounts.length >= 2 ? (
          <button className="quick-btn" onClick={() => ui.open("txForm", { preset: { type: "TRANSFER" } })}>
            <span className="quick-ic trf"><ArrowLeftRight size={21} /></span>O'tkazma
          </button>
        ) : null}
        <button className="quick-btn" onClick={() => ui.open("debtForm", {})}>
          <span className="quick-ic debt"><Handshake size={21} /></span>Qarz
        </button>
      </section>

      <SectionTitle>Hisoblar</SectionTitle>
      <div className="acc-scroll">
        {data.accounts.map((a) => (
          <button className="acc-card" key={a.id} onClick={() => go("transactions", { accountId: a.id })}>
            <span className="acc-icon">{a.icon}</span>
            <span className="acc-name">{a.name}</span>
            <b className="acc-bal num">{mask(fmtMoney(a.balance, a.currency))}</b>
          </button>
        ))}
        <button className="acc-card add" onClick={() => ui.open("accountForm", {})}>
          <span className="acc-icon"><Plus size={20} /></span>
          <span className="acc-name">Hisob qo'shish</span>
        </button>
      </div>

      {series.some((d) => d.income || d.expense) ? (
        <>
          <SectionTitle>So'nggi 7 kun</SectionTitle>
          <div className="card pad">
            <BarChart data={series} currency={primary} height={130} />
          </div>
        </>
      ) : null}

      {dueSoon.length ? (
        <>
          <SectionTitle action={<button className="link-btn" onClick={() => go("debts")}>Barchasi</button>}>Qarz eslatmalari</SectionTitle>
          <div className="card-list">
            {dueSoon.slice(0, 3).map((d) => {
              const due = dueInfo({ status: "OPEN", dueInDays: d.dueInDays });
              return (
                <button className="row" key={d.id} onClick={() => ui.open("debtDetail", { debtId: d.id })}>
                  <Avatar name={d.personName} size={40} />
                  <span className="row-main">
                    <span className="row-title">{d.personName}</span>
                    <span className="row-sub">{d.type === "RECEIVABLE" ? "Sizga to'lashi kerak" : "Siz to'lashingiz kerak"}</span>
                  </span>
                  <span className="row-right">
                    <b className="num">{fmtMoney(d.remaining, d.currency)}</b>
                    <Badge tone={due.tone === "late" ? "danger" : "warn"}>{due.text}</Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <SectionTitle action={<button className="link-btn" onClick={() => go("transactions")}>Barchasi</button>}>Oxirgi operatsiyalar</SectionTitle>
      {data.recent.length ? (
        <div className="card-list">
          {data.recent.slice(0, 6).map((t) => <TxRow key={t.id} tx={t} onClick={() => ui.open("txDetail", { tx: t })} />)}
        </div>
      ) : (
        <EmptyState
          icon="🧾"
          title="Hali operatsiya yo'q"
          text="Birinchi kirim yoki chiqimni yozing — hisobotlar shu yerda paydo bo'ladi."
          action={<button className="btn btn-primary" onClick={() => ui.open("txForm", { preset: { type: "INCOME" } })}>Kirim qo'shish</button>}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------
// Xodim uchun
// ---------------------------------------------------------------
function StaffHome({ data, ui }) {
  const sums = Object.entries(data.today);
  return (
    <>
      <section className="hero">
        <div className="hero-top"><span>Bugun kiritganlarim</span></div>
        <div className="hero-amount num">{data.count} ta</div>
        <div className="hero-split">
          {sums.length ? (
            sums.map(([c, v]) => (
              <div key={c}>
                <span className="hero-lbl"><ArrowDownLeft size={14} /> Kirim</span>
                <b className="num">{fmtMoney(v.income, c)}</b>
                <span className="hero-lbl" style={{ marginTop: 8 }}><ArrowUpRight size={14} /> Chiqim</span>
                <b className="num">{fmtMoney(v.expense, c)}</b>
              </div>
            ))
          ) : (
            <div><span className="hero-lbl">Hali hech narsa kiritilmagan</span></div>
          )}
        </div>
      </section>

      <section className="quick two">
        <button className="quick-btn wide" onClick={() => ui.open("txForm", { preset: { type: "INCOME" } })}>
          <span className="quick-ic inc"><Plus size={22} /></span>Kirim yozish
        </button>
        <button className="quick-btn wide" onClick={() => ui.open("txForm", { preset: { type: "EXPENSE" } })}>
          <span className="quick-ic exp"><Minus size={22} /></span>Chiqim yozish
        </button>
      </section>

      <SectionTitle>Mening oxirgi yozuvlarim</SectionTitle>
      {data.recent.length ? (
        <div className="card-list">
          {data.recent.map((t) => <TxRow key={t.id} tx={t} onClick={() => ui.open("txDetail", { tx: t })} />)}
        </div>
      ) : (
        <EmptyState icon="✍️" title="Hali yozuv yo'q" text="Birinchi operatsiyani kiriting." />
      )}
    </>
  );
}
