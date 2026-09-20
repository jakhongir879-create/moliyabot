import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useMeta } from "../meta";
import { AmountField, Field, Modal, cx, useUI } from "../ui";
import { TYPE_LABEL, fmtMoney, groupInput, parseInput, todayYmd, ymd } from "../format";

// Operatsiya qo'shish / tahrirlash oynasi
export default function TxModal({ tx, onClose }) {
  const { accounts, categories, rates } = useMeta();
  const qc = useQueryClient();
  const ui = useUI();
  const editing = Boolean(tx);

  const [type, setType] = useState(tx?.type ?? "INCOME");
  const [amount, setAmount] = useState(tx ? groupInput(String(tx.amount)) : "");
  const [accountId, setAccountId] = useState(tx?.accountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? "");
  const [toAmount, setToAmount] = useState(tx?.toAmount && tx.toAccount?.currency !== tx.currency ? groupInput(String(tx.toAmount)) : "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? "");
  const [note, setNote] = useState(tx?.note ?? "");
  const [date, setDate] = useState(tx ? ymd(tx.date) : todayYmd());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const account = accounts.find((a) => a.id === Number(accountId));
  const toAccount = accounts.find((a) => a.id === Number(toAccountId));
  const currency = account?.currency || "UZS";
  const cross = type === "TRANSFER" && account && toAccount && account.currency !== toAccount.currency;
  const cats = categories.filter((c) => c.type === type && (!c.isSystem || c.id === tx?.categoryId));

  const rateOf = (c) => (c === "UZS" ? 1 : rates?.[c]);
  const suggested =
    cross && rateOf(account.currency) && rateOf(toAccount.currency) && parseInput(amount) > 0
      ? Math.round(((parseInput(amount) * rateOf(account.currency)) / rateOf(toAccount.currency)) * 100) / 100
      : null;

  const changeType = (next) => {
    setType(next);
    setCategoryId("");
  };

  const submit = async () => {
    setError("");
    if (!(parseInput(amount) > 0)) return setError("Summani kiriting");
    if (!accountId) return setError("Hisobni tanlang");
    if (type !== "TRANSFER" && !categoryId) return setError("Toifani tanlang");
    if (type === "TRANSFER" && (!toAccountId || Number(toAccountId) === Number(accountId))) return setError("Qabul qiluvchi hisobni tanlang");
    if (cross && !(parseInput(toAmount) > 0)) return setError("Qabul qilinadigan summani kiriting");

    const body = {
      type,
      amount: parseInput(amount),
      accountId: Number(accountId),
      date,
      note: note.trim() || undefined,
      ...(type === "TRANSFER" ? { toAccountId: Number(toAccountId), toAmount: cross ? parseInput(toAmount) : undefined } : { categoryId: Number(categoryId) }),
    };

    setBusy(true);
    try {
      if (editing) await api(`/transactions/${tx.id}`, { method: "PUT", body });
      else await api("/transactions", { method: "POST", body });
      qc.invalidateQueries();
      ui.toast(editing ? "O'zgarishlar saqlandi" : `${TYPE_LABEL[type]} qo'shildi`, "success");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? "Operatsiyani tahrirlash" : "Yangi operatsiya"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        </>
      }
    >
      <div className="seg">
        {["INCOME", "EXPENSE", "TRANSFER"].map((t) => (
          <button key={t} className={cx("seg-item", type === t && "active", `tone-${t.toLowerCase()}`)} onClick={() => changeType(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>

      <div className="form-grid">
        <Field label="Summa">
          <AmountField value={amount} onChange={setAmount} currency={currency} autoFocus={!editing} />
        </Field>
        <Field label="Sana">
          <input className="input" type="date" value={date} max={todayYmd()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
        <Field label={type === "TRANSFER" ? "Qaysi hisobdan" : "Hisob"}>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.currency})</option>)}
          </select>
        </Field>
        {type === "TRANSFER" ? (
          <Field label="Qaysi hisobga">
            <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Tanlang...</option>
              {accounts.filter((a) => a.id !== Number(accountId)).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.currency})</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Toifa">
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tanlang...</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </Field>
        )}
      </div>

      {cross ? (
        <Field label={`Qabul qilinadigan summa (${toAccount.currency})`} hint={suggested ? `Markaziy bank kursi bo'yicha: ${fmtMoney(suggested, toAccount.currency)}` : undefined}>
          <AmountField value={toAmount} onChange={setToAmount} currency={toAccount.currency} />
          {suggested ? <button className="link-btn" type="button" onClick={() => setToAmount(groupInput(String(suggested)))}>Kurs bo'yicha to'ldirish</button> : null}
        </Field>
      ) : null}

      <Field label="Izoh">
        <input className="input" maxLength={300} placeholder="Ixtiyoriy" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}
