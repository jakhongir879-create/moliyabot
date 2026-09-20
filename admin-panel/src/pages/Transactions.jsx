import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api, downloadFile } from "../api";
import { useMeta } from "../meta";
import { Badge, Card, EmptyState, ErrorBox, Pagination, Spinner, cx, useUI } from "../ui";
import { TYPE_LABEL, fmtDate, fmtMoney, fmtShort, timeOf } from "../format";
import TxModal from "./TxModal";

const PAGE = 25;

const PERIOD_OPTIONS = [
  ["all", "Barcha vaqt"],
  ["today", "Bugun"],
  ["yesterday", "Kecha"],
  ["week", "Shu hafta"],
  ["month", "Shu oy"],
  ["lastMonth", "O'tgan oy"],
  ["year", "Shu yil"],
  ["custom", "Sana oralig'i"],
];

// Operatsiyalar jadvali (Dashboard'da ham ishlatiladi)
export function TxTable({ items, compact = false, onEdit, onDelete }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Sana</th>
            <th>Tur</th>
            <th>Toifa</th>
            <th>Hisob</th>
            {!compact ? <th>Izoh</th> : null}
            {!compact ? <th>Kim kiritdi</th> : null}
            <th className="right">Summa</th>
            {onEdit ? <th className="actions-col" /> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const transfer = t.type === "TRANSFER";
            const income = t.type === "INCOME";
            return (
              <tr key={t.id}>
                <td className="nowrap">
                  {fmtShort(t.date)} <span className="muted">{timeOf(t.date)}</span>
                </td>
                <td><Badge tone={transfer ? "info" : income ? "success" : "danger"}>{TYPE_LABEL[t.type]}</Badge></td>
                <td>{transfer ? <span className="muted">—</span> : <span>{t.category?.icon} {t.category?.name || "Toifasiz"}</span>}</td>
                <td className="nowrap">{transfer ? `${t.account?.name} → ${t.toAccount?.name}` : t.account?.name}</td>
                {!compact ? <td className="note-col" title={t.note || ""}>{t.note || <span className="muted">—</span>}</td> : null}
                {!compact ? <td>{t.createdBy?.name || <span className="muted">—</span>}</td> : null}
                <td className={cx("right num strong", transfer ? "" : income ? "pos" : "neg")}>
                  {transfer ? fmtMoney(t.amount, t.currency) : fmtMoney(income ? t.amount : -t.amount, t.currency, { sign: true })}
                </td>
                {onEdit ? (
                  <td className="actions-col">
                    {t.locked ? (
                      <span className="muted small" title="Qarz bilan bog'langan">🔒</span>
                    ) : (
                      <>
                        <button className="icon-btn" onClick={() => onEdit(t)} aria-label="Tahrirlash"><Pencil size={16} /></button>
                        <button className="icon-btn danger" onClick={() => onDelete(t)} aria-label="O'chirish"><Trash2 size={16} /></button>
                      </>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Transactions() {
  const { accounts, categories } = useMeta();
  const qc = useQueryClient();
  const ui = useUI();

  const [filters, setFilters] = useState({ period: "all", from: "", to: "", type: "", accountId: "", categoryId: "", userId: "", q: "" });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | { tx? }
  const [exporting, setExporting] = useState(false);

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const users = useQuery({ queryKey: ["users"], queryFn: () => api("/users") });

  const params = {
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    userId: filters.userId,
    q: filters.q.trim(),
    ...(filters.period === "custom" ? { from: filters.from, to: filters.to } : { period: filters.period }),
  };
  const customReady = filters.period !== "custom" || (filters.from && filters.to);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["transactions", params, page],
    queryFn: () => api("/transactions", { params: { ...params, limit: PAGE, offset: (page - 1) * PAGE } }),
    enabled: Boolean(customReady),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const remove = async (tx) => {
    const ok = await ui.confirm({
      title: "Operatsiyani o'chirish",
      message: `${TYPE_LABEL[tx.type]} — ${fmtMoney(tx.amount, tx.currency)} (${fmtDate(tx.date)}) o'chiriladi. Hisob qoldig'i qayta hisoblanadi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/transactions/${tx.id}`, { method: "DELETE" });
      qc.invalidateQueries();
      ui.toast("Operatsiya o'chirildi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

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

  const activeCount = ["type", "accountId", "categoryId", "userId", "q"].filter((k) => filters[k]).length + (filters.period !== "all" ? 1 : 0);
  const reset = () => set({ period: "all", from: "", to: "", type: "", accountId: "", categoryId: "", userId: "", q: "" });

  return (
    <>
      <div className="page-actions">
        <span className="live"><i className="dot on pulse" /> Jonli: har 15 soniyada yangilanadi{isFetching ? " · yangilanmoqda..." : ""}</span>
        <div className="row-gap">
          <button className="btn" onClick={exportExcel} disabled={exporting}><Download size={16} /> {exporting ? "Tayyorlanmoqda..." : "Excel"}</button>
          <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={17} /> Yangi operatsiya</button>
        </div>
      </div>

      <Card pad={false} className="filters-card">
        <div className="filters">
          <div className="search-box">
            <Search size={16} />
            <input placeholder="Izoh, toifa, hisob yoki summa bo'yicha qidirish" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
            {filters.q ? <button onClick={() => set({ q: "" })} aria-label="Tozalash"><X size={15} /></button> : null}
          </div>
          <select className="input" value={filters.period} onChange={(e) => set({ period: e.target.value })}>
            {PERIOD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {filters.period === "custom" ? (
            <>
              <input className="input" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
              <input className="input" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
            </>
          ) : null}
          <select className="input" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">Barcha turlar</option>
            <option value="INCOME">Kirim</option>
            <option value="EXPENSE">Chiqim</option>
            <option value="TRANSFER">O'tkazma</option>
          </select>
          <select className="input" value={filters.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            <option value="">Barcha hisoblar</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
          <select className="input" value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">Barcha toifalar</option>
            {categories.filter((c) => (filters.type ? c.type === filters.type : true)).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select className="input" value={filters.userId} onChange={(e) => set({ userId: e.target.value })}>
            <option value="">Barcha foydalanuvchilar</option>
            {(users.data?.items || []).filter((u) => u.status !== "PENDING").map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          {activeCount ? <button className="btn btn-sm" onClick={reset}><X size={14} /> Tozalash ({activeCount})</button> : null}
        </div>
      </Card>

      {data && data.total > 0 ? (
        <div className="totals-strip">
          {Object.entries(data.totals).map(([c, t]) => (
            <div className="total-chip" key={c}>
              <b>{c}</b>
              <span className="pos num">{fmtMoney(t.income, c, { sign: true })}</span>
              <span className="neg num">{fmtMoney(-t.expense, c, { sign: true })}</span>
              {t.transfer ? <span className="muted num">↔ {fmtMoney(t.transfer, c)}</span> : null}
            </div>
          ))}
          <span className="muted">Jami {data.total} ta operatsiya</span>
        </div>
      ) : null}

      <Card pad={false}>
        {!customReady ? (
          <EmptyState icon="📅" title="Sana oralig'ini tanlang" />
        ) : isPending ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} onRetry={refetch} />
        ) : data.items.length ? (
          <>
            <TxTable items={data.items} onEdit={(tx) => setModal({ tx })} onDelete={remove} />
            <Pagination page={page} pageSize={PAGE} total={data.total} onChange={setPage} />
          </>
        ) : (
          <EmptyState icon="🔎" title="Hech narsa topilmadi" text={activeCount ? "Filtrlarni o'zgartirib ko'ring." : "Hali operatsiya yozilmagan."} />
        )}
      </Card>

      {modal ? <TxModal tx={modal.tx} onClose={() => setModal(null)} /> : null}
    </>
  );
}
