import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useDebounced, useInfiniteSentinel } from "../lib/hooks";
import { api } from "../lib/api";
import { Chip, EmptyState, ErrorBox, ListSkeleton, Segmented } from "../ui/common";
import TxRow from "../ui/TxRow";
import { dayLabel, fmtMoney, fmtYmd, ymd } from "../lib/format";

const TYPE_OPTIONS = [
  { value: "", label: "Hammasi" },
  { value: "INCOME", label: "Kirim", tone: "income" },
  { value: "EXPENSE", label: "Chiqim", tone: "expense" },
  { value: "TRANSFER", label: "O'tkazma", tone: "transfer" },
];

const PERIODS = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Oy" },
  { value: "custom", label: "Sana" },
];

function groupByDay(items) {
  const groups = [];
  for (const t of items) {
    const key = ymd(t.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(t);
    else groups.push({ key, items: [t] });
  }
  return groups;
}

export default function Transactions({ preset }) {
  const { accounts, categories, perms } = useApp();
  const ui = useUI();

  const [type, setType] = useState("");
  const [period, setPeriod] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [accountId, setAccountId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);

  // Bosh sahifadan hisob tanlab kelinganda filtrni qo'llash
  useEffect(() => {
    if (preset) {
      setAccountId(preset.accountId ?? null);
      setType("");
      setCategoryId(null);
      setPeriod("all");
      setQ("");
    }
  }, [preset]);

  const params = {
    type: type || undefined,
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    q: dq.trim() || undefined,
    ...(period === "custom" ? { from: range.from, to: range.to } : period !== "all" ? { period } : {}),
  };

  const query = useInfiniteQuery({
    queryKey: ["transactions", params],
    queryFn: ({ pageParam }) => api("/transactions", { params: { ...params, offset: pageParam, limit: 30 } }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.reduce((n, p) => n + p.items.length, 0) : undefined),
  });

  const items = useMemo(() => (query.data ? query.data.pages.flatMap((p) => p.items) : []), [query.data]);
  const groups = useMemo(() => groupByDay(items), [items]);
  const totals = query.data?.pages[0]?.totals || {};
  const total = query.data?.pages[0]?.total ?? 0;
  const sentinel = useInfiniteSentinel(() => query.fetchNextPage(), Boolean(query.hasNextPage && !query.isFetchingNextPage));

  const activeFilters = (accountId ? 1 : 0) + (categoryId ? 1 : 0);
  const account = accounts.find((a) => a.id === accountId);
  const category = categories.find((c) => c.id === categoryId);

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
  };

  return (
    <div className="screen">
      <h1 className="page-title">Operatsiyalar</h1>

      <div className="search-row">
        <div className="search">
          <Search size={18} />
          <input placeholder="Izoh, toifa yoki summa bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button onClick={() => setQ("")} aria-label="Tozalash"><X size={16} /></button> : null}
        </div>
        <button
          className={`icon-btn filter-btn ${activeFilters ? "on" : ""}`}
          onClick={() =>
            ui.open("txFilters", {
              accountId,
              categoryId,
              type,
              onApply: (a, c) => {
                setAccountId(a);
                setCategoryId(c);
              },
            })
          }
          aria-label="Filtr"
        >
          <SlidersHorizontal size={19} />
          {activeFilters ? <i>{activeFilters}</i> : null}
        </button>
      </div>

      {perms.createTransfers ? (
        <Segmented small options={TYPE_OPTIONS} value={type} onChange={setType} />
      ) : (
        <Segmented small options={TYPE_OPTIONS.filter((o) => o.value !== "TRANSFER")} value={type} onChange={setType} />
      )}

      <div className="chip-scroll" style={{ marginTop: 10 }}>
        {PERIODS.map((p) => (
          <Chip key={p.value} active={period === p.value} onClick={() => pickPeriod(p.value)}>
            {p.value === "custom" && period === "custom" && range.from ? `${fmtYmd(range.from, { year: false })} – ${fmtYmd(range.to, { year: false })}` : p.label}
          </Chip>
        ))}
      </div>

      {(account || category) ? (
        <div className="chip-scroll" style={{ marginTop: 8 }}>
          {account ? <Chip active onClick={() => setAccountId(null)}>{account.icon} {account.name} <X size={13} /></Chip> : null}
          {category ? <Chip active onClick={() => setCategoryId(null)}>{category.icon} {category.name} <X size={13} /></Chip> : null}
        </div>
      ) : null}

      {!query.isPending && !query.error && total > 0 ? (
        <div className="summary-strip">
          {Object.entries(totals).map(([cur, t]) => (
            <div className="summary-item" key={cur}>
              {type !== "EXPENSE" && type !== "TRANSFER" ? <span className="pos num">{fmtMoney(t.income, cur, { sign: true })}</span> : null}
              {type !== "INCOME" && type !== "TRANSFER" ? <span className="neg num">{fmtMoney(-t.expense, cur, { sign: true })}</span> : null}
              {type === "TRANSFER" ? <span className="num">{fmtMoney(t.transfer, cur)}</span> : null}
            </div>
          ))}
          <span className="muted small">{total} ta</span>
        </div>
      ) : null}

      {query.isPending ? (
        <ListSkeleton rows={7} />
      ) : query.error ? (
        <ErrorBox error={query.error} onRetry={query.refetch} />
      ) : groups.length ? (
        <>
          {groups.map((g) => {
            const net = {};
            for (const t of g.items) {
              if (t.type === "TRANSFER") continue;
              net[t.currency] = (net[t.currency] || 0) + (t.type === "INCOME" ? t.amount : -t.amount);
            }
            const netEntries = Object.entries(net);
            return (
              <section key={g.key} className="day-group">
                <div className="day-head">
                  <span>{dayLabel(g.key)}</span>
                  {netEntries.length === 1 ? <span className="num">{fmtMoney(netEntries[0][1], netEntries[0][0], { sign: true })}</span> : null}
                </div>
                <div className="card-list">
                  {g.items.map((t) => <TxRow key={t.id} tx={t} onClick={() => ui.open("txDetail", { tx: t })} />)}
                </div>
              </section>
            );
          })}
          <div ref={sentinel} style={{ height: 1 }} />
          {query.isFetchingNextPage ? <ListSkeleton rows={2} /> : null}
          {!query.hasNextPage ? <div className="muted small center" style={{ padding: 16 }}>Hammasi shu</div> : null}
        </>
      ) : (
        <EmptyState
          icon="🔎"
          title="Hech narsa topilmadi"
          text={dq || activeFilters || type || period !== "all" ? "Filtrlarni o'zgartirib ko'ring." : "Hali operatsiya yozilmagan."}
        />
      )}
    </div>
  );
}
