import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Search, Trash2 } from "lucide-react";
import { api } from "../api";
import { useMeta } from "../meta";
import { AmountField, Avatar, Badge, Card, EmptyState, ErrorBox, Field, Modal, Spinner, Tabs, cx, useUI } from "../ui";
import { CURRENCIES, dueInfo, fmtDate, fmtMoney, fmtNumber, fmtShort, groupInput, parseInput, todayYmd, ymd } from "../format";

// ---------------------------------------------------------------
// Qarz qo'shish / tahrirlash
// ---------------------------------------------------------------
function DebtModal({ debt, defaultType, onClose }) {
  const { accounts } = useMeta();
  const qc = useQueryClient();
  const ui = useUI();
  const editing = Boolean(debt);
  const currencies = [...new Set(accounts.map((a) => a.currency))];

  const [type, setType] = useState(debt?.type ?? defaultType ?? "RECEIVABLE");
  const [personName, setPersonName] = useState(debt?.personName ?? "");
  const [phone, setPhone] = useState(debt?.phone ?? "");
  const [amount, setAmount] = useState(debt ? groupInput(String(debt.amount)) : "");
  const [currency, setCurrency] = useState(debt?.currency ?? currencies[0] ?? "UZS");
  const [dueDate, setDueDate] = useState(debt?.dueDate ? ymd(debt.dueDate) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [moneyMoved, setMoneyMoved] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const matching = accounts.filter((a) => a.currency === currency);
  const amountLocked = editing && debt.moneyMoved;

  const submit = async () => {
    setError("");
    if (!personName.trim()) return setError("Ism yoki nomni kiriting");
    if (!(parseInput(amount) > 0)) return setError("Summani kiriting");
    if (moneyMoved && !accountId) return setError("Pul harakati uchun hisobni tanlang");
    setBusy(true);
    try {
      if (editing) {
        await api(`/debts/${debt.id}`, {
          method: "PATCH",
          body: { personName: personName.trim(), phone: phone.trim(), dueDate: dueDate || null, note: note.trim(), ...(amountLocked ? {} : { amount: parseInput(amount) }) },
        });
      } else {
        await api("/debts", {
          method: "POST",
          body: {
            type,
            personName: personName.trim(),
            phone: phone.trim() || undefined,
            amount: parseInput(amount),
            currency,
            dueDate: dueDate || undefined,
            note: note.trim() || undefined,
            moneyMoved,
            accountId: moneyMoved ? Number(accountId) : undefined,
          },
        });
      }
      qc.invalidateQueries();
      ui.toast(editing ? "Qarz yangilandi" : "Qarz qo'shildi", "success");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? "Qarzni tahrirlash" : "Yangi qarz"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        </>
      }
    >
      {!editing ? (
        <div className="seg">
          <button className={cx("seg-item", type === "RECEIVABLE" && "active", "tone-income")} onClick={() => setType("RECEIVABLE")}>Menga qarzdor</button>
          <button className={cx("seg-item", type === "PAYABLE" && "active", "tone-expense")} onClick={() => setType("PAYABLE")}>Men qarzdorman</button>
        </div>
      ) : null}

      <div className="form-grid">
        <Field label={type === "RECEIVABLE" ? "Kim qarzdor?" : "Kimga qarzdorsiz?"}>
          <input className="input" autoFocus={!editing} maxLength={100} placeholder="Ism yoki tashkilot" value={personName} onChange={(e) => setPersonName(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <input className="input" maxLength={30} placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Summa" hint={amountLocked ? "Pul harakati bilan yozilgan qarz summasini o'zgartirib bo'lmaydi" : undefined}>
          <AmountField value={amount} onChange={setAmount} currency={currency} />
        </Field>
        {!editing ? (
          <Field label="Valyuta">
            <select className="input" value={currency} onChange={(e) => { setCurrency(e.target.value); setAccountId(""); }}>
              {(currencies.length ? currencies : ["UZS"]).map((c) => <option key={c} value={c}>{CURRENCIES[c]?.label || c} ({c})</option>)}
            </select>
          </Field>
        ) : <span />}
        <Field label="To'lash muddati">
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Izoh">
          <input className="input" maxLength={300} placeholder="Ixtiyoriy" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      {!editing ? (
        <div className="check-card">
          <label className="check">
            <input type="checkbox" checked={moneyMoved} onChange={(e) => setMoneyMoved(e.target.checked)} />
            <span>
              <b>{type === "RECEIVABLE" ? "Pulni hisobimdan berdim" : "Pulni hisobimga oldim"}</b>
              <small>Yoqilsa, tanlangan hisobda {type === "RECEIVABLE" ? "chiqim" : "kirim"} yoziladi. Nasiya savdo/xarid bo'lsa, belgilamang.</small>
            </span>
          </label>
          {moneyMoved ? (
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Hisobni tanlang...</option>
              {matching.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}

// ---------------------------------------------------------------
// Qarz tafsiloti va to'lovlar
// ---------------------------------------------------------------
function DebtDetail({ id, onClose, onEdit }) {
  const { accounts } = useMeta();
  const qc = useQueryClient();
  const ui = useUI();
  const { data: debt, isLoading, error, refetch } = useQuery({ queryKey: ["debt", id], queryFn: () => api(`/debts/${id}`) });

  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  if (isLoading) return <Modal title="Qarz" onClose={onClose}><Spinner /></Modal>;
  if (error) return <Modal title="Qarz" onClose={onClose}><ErrorBox error={error} onRetry={refetch} /></Modal>;

  const receivable = debt.type === "RECEIVABLE";
  const matching = accounts.filter((a) => a.currency === debt.currency);
  const due = dueInfo(debt);
  const progress = debt.amount ? Math.min(100, Math.round((debt.paid / debt.amount) * 100)) : 0;

  const addPayment = async () => {
    setFormError("");
    const value = parseInput(amount);
    if (!(value > 0)) return setFormError("To'lov summasini kiriting");
    if (!accountId) return setFormError("Hisobni tanlang");
    setBusy(true);
    try {
      await api(`/debts/${id}/payments`, { method: "POST", body: { amount: value, accountId: Number(accountId), date, note: note.trim() || undefined } });
      qc.invalidateQueries();
      ui.toast("To'lov yozildi", "success");
      setAmount("");
      setNote("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removePayment = async (p) => {
    const ok = await ui.confirm({ title: "To'lovni bekor qilish", message: `${fmtMoney(p.amount, debt.currency)} to'lovi va uning kassadagi yozuvi o'chiriladi.`, confirmText: "Bekor qilish", danger: true });
    if (!ok) return;
    try {
      await api(`/debts/${id}/payments/${p.id}`, { method: "DELETE" });
      qc.invalidateQueries();
      ui.toast("To'lov bekor qilindi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  const removeDebt = async () => {
    const ok = await ui.confirm({ title: "Qarzni o'chirish", message: "Qarz va u bilan bog'liq barcha to'lovlar (kassadagi yozuvlari bilan birga) o'chiriladi.", confirmText: "O'chirish", danger: true });
    if (!ok) return;
    try {
      await api(`/debts/${id}`, { method: "DELETE" });
      qc.invalidateQueries();
      ui.toast("Qarz o'chirildi", "success");
      onClose();
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  return (
    <Modal
      title={receivable ? "Menga qarzdor" : "Men qarzdorman"}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-soft" onClick={removeDebt}><Trash2 size={16} /> O'chirish</button>
          <span className="grow" />
          <button className="btn" onClick={() => onEdit(debt)}>Tahrirlash</button>
          <button className="btn btn-primary" onClick={onClose}>Yopish</button>
        </>
      }
    >
      <div className="debt-top">
        <Avatar name={debt.personName} size={48} />
        <div className="grow">
          <div className="debt-name">{debt.personName}</div>
          {debt.phone ? <a className="link-btn" href={`tel:${debt.phone.replace(/[^\d+]/g, "")}`}><Phone size={13} /> {debt.phone}</a> : <span className="muted">Telefon yo'q</span>}
        </div>
        <Badge tone={due.tone}>{due.text}</Badge>
      </div>

      <div className="debt-figures">
        <div><span>Jami</span><b className="num">{fmtMoney(debt.amount, debt.currency)}</b></div>
        <div><span>To'langan</span><b className="num">{fmtMoney(debt.paid, debt.currency)}</b></div>
        <div><span>Qoldiq</span><b className={cx("num", receivable ? "pos" : "neg")}>{fmtMoney(debt.remaining, debt.currency)}</b></div>
      </div>
      <div className="progress"><span style={{ width: `${progress}%` }} /></div>
      <div className="muted small" style={{ marginTop: 8 }}>
        {debt.dueDate ? `Muddat: ${fmtDate(debt.dueDate)} · ` : ""}Yozilgan: {fmtDate(debt.createdAt)}{debt.note ? ` · ${debt.note}` : ""}{debt.createdBy ? ` · ${debt.createdBy.name}` : ""}
      </div>

      {debt.status === "OPEN" ? (
        <div className="pay-form">
          <h4>{receivable ? "To'lov qabul qilish" : "To'lov qilish"}</h4>
          <div className="form-grid four">
            <Field label="Summa">
              <AmountField value={amount} onChange={setAmount} currency={debt.currency} placeholder={fmtNumber(debt.remaining)} />
            </Field>
            <Field label={receivable ? "Qaysi hisobga" : "Qaysi hisobdan"}>
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Tanlang...</option>
                {matching.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </Field>
            <Field label="Sana"><input className="input" type="date" value={date} max={todayYmd()} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
            <Field label="Izoh"><input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div className="row-gap">
            <button className="btn btn-primary" disabled={busy} onClick={addPayment}>{busy ? "Yozilmoqda..." : "To'lovni yozish"}</button>
            <button className="btn btn-sm" onClick={() => setAmount(groupInput(String(debt.remaining)))}>Qoldiqni to'liq</button>
            {formError ? <span className="form-error inline">{formError}</span> : null}
          </div>
        </div>
      ) : null}

      <h4 className="section-h">To'lovlar tarixi</h4>
      {debt.payments.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Sana</th><th>Hisob</th><th>Izoh</th><th>Kim</th><th className="right">Summa</th><th /></tr></thead>
            <tbody>
              {[...debt.payments].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{fmtShort(p.date)}</td>
                  <td>{p.account?.name || "—"}</td>
                  <td>{p.note || <span className="muted">—</span>}</td>
                  <td>{p.createdBy?.name || <span className="muted">—</span>}</td>
                  <td className="right num strong">{fmtMoney(p.amount, debt.currency)}</td>
                  <td className="actions-col"><button className="icon-btn danger" onClick={() => removePayment(p)} aria-label="O'chirish"><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">To'lovlar hali yo'q.</p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------
// Sahifa
// ---------------------------------------------------------------
export default function Debts() {
  const [tab, setTab] = useState("RECEIVABLE");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // {kind: 'new' | 'edit' | 'detail', ...}

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["debts", tab, q],
    queryFn: () => api("/debts", { params: tab === "CLOSED" ? { status: "CLOSED", q } : { type: tab, status: "OPEN", q } }),
    refetchInterval: 20_000,
  });

  const counts = data?.summary.counts;
  const totals = data?.summary.totals;

  return (
    <>
      <div className="page-actions">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "RECEIVABLE", label: "Menga qarzdor", count: counts?.RECEIVABLE },
            { value: "PAYABLE", label: "Men qarzdorman", count: counts?.PAYABLE },
            { value: "CLOSED", label: "Yopilganlar" },
          ]}
        />
        <div className="row-gap">
          <div className="search-box sm">
            <Search size={15} />
            <input placeholder="Ism, telefon, izoh" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setModal({ kind: "new" })}><Plus size={17} /> Yangi qarz</button>
        </div>
      </div>

      {totals && tab !== "CLOSED" ? (
        <div className={cx("debt-banner", tab === "RECEIVABLE" ? "inc" : "exp")}>
          <span>{tab === "RECEIVABLE" ? "Sizga to'lashlari kerak" : "Siz to'lashingiz kerak"}</span>
          <b className="num">
            {Object.keys(totals[tab]).length ? Object.entries(totals[tab]).map(([c, v]) => fmtMoney(v, c)).join(" + ") : fmtMoney(0, "UZS")}
          </b>
          {data.summary.overdue ? <Badge tone="danger">⚠️ Muddati o'tgan: {data.summary.overdue} ta</Badge> : null}
        </div>
      ) : null}

      <Card pad={false}>
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox error={error} onRetry={refetch} />
        ) : data.items.length ? (
          <div className="table-wrap">
            <table className="table clickable">
              <thead>
                <tr><th>Ism / nom</th><th>Telefon</th><th>Izoh</th><th className="right">Summa</th><th className="right">To'langan</th><th className="right">Qoldiq</th><th>Muddat</th><th>Holat</th></tr>
              </thead>
              <tbody>
                {data.items.map((d) => {
                  const due = dueInfo(d);
                  return (
                    <tr key={d.id} onClick={() => setModal({ kind: "detail", id: d.id })}>
                      <td><span className="person"><Avatar name={d.personName} size={30} /> {d.personName}</span></td>
                      <td className="nowrap">{d.phone || <span className="muted">—</span>}</td>
                      <td className="note-col" title={d.note || ""}>{d.note || <span className="muted">—</span>}</td>
                      <td className="right num">{fmtMoney(d.amount, d.currency)}</td>
                      <td className="right num">{fmtMoney(d.paid, d.currency)}</td>
                      <td className={cx("right num strong", d.type === "RECEIVABLE" ? "pos" : "neg")}>{fmtMoney(d.remaining, d.currency)}</td>
                      <td className="nowrap">{d.dueDate ? fmtShort(d.dueDate) : <span className="muted">—</span>}</td>
                      <td><Badge tone={due.tone}>{due.text}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="🤝" title="Qarz topilmadi" text="«Yangi qarz» tugmasi orqali qo'shing." />
        )}
      </Card>

      {modal?.kind === "new" ? <DebtModal defaultType={tab === "PAYABLE" ? "PAYABLE" : "RECEIVABLE"} onClose={() => setModal(null)} /> : null}
      {modal?.kind === "edit" ? <DebtModal debt={modal.debt} onClose={() => setModal(null)} /> : null}
      {modal?.kind === "detail" ? <DebtDetail id={modal.id} onClose={() => setModal(null)} onEdit={(debt) => setModal({ kind: "edit", debt })} /> : null}
    </>
  );
}
