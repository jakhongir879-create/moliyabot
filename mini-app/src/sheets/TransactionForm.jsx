import { useEffect, useMemo, useState } from "react";
import Sheet from "../ui/Sheet";
import { AmountInput, Chip, Field, Segmented, cx } from "../ui/common";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { readStore, useAction, writeStore } from "../lib/hooks";
import { api } from "../lib/api";
import { CURRENCIES, addDaysYmd, fmtMoney, groupInput, parseInput, todayYmd, ymd } from "../lib/format";
import { TYPE_LABEL } from "../lib/constants";
import { haptic } from "../lib/telegram";

// Kirim / chiqim / o'tkazma qo'shish va tahrirlash oynasi
export default function TransactionForm({ sheetId, closing, tx, preset }) {
  const { accounts, categories, perms, rates } = useApp();
  const ui = useUI();
  const run = useAction();
  const editing = Boolean(tx);

  const canTransfer = perms.createTransfers && accounts.length >= 2;
  const [type, setType] = useState(tx?.type ?? preset?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(() => {
    const v = tx?.amount ?? preset?.amount;
    return v ? groupInput(String(v)) : "";
  });
  const [accountId, setAccountId] = useState(() => {
    if (tx?.accountId) return tx.accountId;
    if (preset?.accountId) return preset.accountId;
    const last = readStore("lastAccount");
    return accounts.some((a) => a.id === last) ? last : accounts[0]?.id ?? null;
  });
  const [toAccountId, setToAccountId] = useState(tx?.toAccountId ?? null);
  const [toAmount, setToAmount] = useState(tx?.toAmount && tx.toAccount?.currency !== tx.currency ? groupInput(String(tx.toAmount)) : "");
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? preset?.categoryId ?? null);
  const [note, setNote] = useState(tx?.note ?? preset?.note ?? "");
  const [date, setDate] = useState(tx ? ymd(tx.date) : todayYmd());
  const [busy, setBusy] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const currency = account?.currency || "UZS";

  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === type && (!c.isSystem || c.id === tx?.categoryId)),
    [categories, type, tx]
  );

  // Tur o'zgarganda mos toifani tanlaymiz (oxirgi ishlatilgan yoki hech biri)
  useEffect(() => {
    if (type === "TRANSFER") return;
    if (typeCategories.some((c) => c.id === categoryId)) return;
    const last = readStore(`lastCategory_${type}`);
    setCategoryId(typeCategories.some((c) => c.id === last) ? last : null);
  }, [type, typeCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  const cross = type === "TRANSFER" && account && toAccount && account.currency !== toAccount.currency;
  const rateOf = (c) => (c === "UZS" ? 1 : rates?.[c]);
  const suggested =
    cross && rateOf(account.currency) && rateOf(toAccount.currency) && parseInput(amount) > 0
      ? Math.round(((parseInput(amount) * rateOf(account.currency)) / rateOf(toAccount.currency)) * 100) / 100
      : null;

  const amountNum = parseInput(amount);
  const valid =
    amountNum > 0 &&
    accountId &&
    (type === "TRANSFER"
      ? toAccountId && toAccountId !== accountId && (!cross || parseInput(toAmount) > 0)
      : Boolean(categoryId));

  const typeOptions = [
    { value: "INCOME", label: "Kirim", tone: "income" },
    { value: "EXPENSE", label: "Chiqim", tone: "expense" },
    ...(canTransfer ? [{ value: "TRANSFER", label: "O'tkazma", tone: "transfer" }] : []),
  ];

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const body = {
      type,
      amount: amountNum,
      accountId,
      date,
      note: note.trim() || undefined,
      ...(type === "TRANSFER"
        ? { toAccountId, toAmount: cross ? parseInput(toAmount) : undefined }
        : { categoryId }),
    };
    try {
      await run(
        () => (editing ? api(`/transactions/${tx.id}`, { method: "PUT", body }) : api("/transactions", { method: "POST", body })),
        { success: editing ? "O'zgarishlar saqlandi" : `${TYPE_LABEL[type]} qo'shildi` }
      );
      writeStore("lastAccount", accountId);
      if (type !== "TRANSFER") writeStore(`lastCategory_${type}`, categoryId);
      ui.close(sheetId);
    } catch {
      setBusy(false);
    }
  };

  const label = `${editing ? "Saqlash" : `${TYPE_LABEL[type]} qo'shish`}${amountNum > 0 ? ` — ${fmtMoney(amountNum, currency)}` : ""}`;

  return (
    <Sheet
      title={editing ? "Operatsiyani tahrirlash" : "Yangi operatsiya"}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      tall
      footer={
        <button className={cx("btn btn-primary btn-block btn-lg", `cta-${type.toLowerCase()}`)} disabled={!valid || busy} onClick={submit}>
          {busy ? "Saqlanmoqda..." : label}
        </button>
      }
    >
      <Segmented options={typeOptions} value={type} onChange={(v) => { haptic("select"); setType(v); }} />

      <div className="amount-wrap">
        <AmountInput value={amount} onChange={setAmount} currency={currency} autoFocus={!editing && !preset?.amount} />
        <div className="amount-tools">
          <button className="mini-btn" onClick={() => setAmount((a) => (a ? groupInput(`${a.replace(/\s/g, "")}000`) : ""))}>
            + 000
          </button>
          {amountNum > 0 ? (
            <button className="mini-btn" onClick={() => setAmount("")}>
              Tozalash
            </button>
          ) : null}
        </div>
      </div>

      <Field label={type === "TRANSFER" ? "Qaysi hisobdan" : "Hisob"}>
        <div className="chip-scroll">
          {accounts.map((a) => (
            <Chip key={a.id} active={a.id === accountId} onClick={() => { setAccountId(a.id); if (a.id === toAccountId) setToAccountId(null); }}>
              <span>{a.icon}</span> {a.name} <em>{CURRENCIES[a.currency]?.code !== "UZS" ? a.currency : ""}</em>
            </Chip>
          ))}
        </div>
      </Field>

      {type === "TRANSFER" ? (
        <>
          <Field label="Qaysi hisobga">
            <div className="chip-scroll">
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <Chip key={a.id} active={a.id === toAccountId} onClick={() => setToAccountId(a.id)}>
                    <span>{a.icon}</span> {a.name} <em>{a.currency !== "UZS" ? a.currency : ""}</em>
                  </Chip>
                ))}
            </div>
          </Field>
          {cross ? (
            <Field label={`Qabul qilinadigan summa (${toAccount.currency})`}>
              <input className="input" inputMode="decimal" placeholder="0" value={toAmount} onChange={(e) => setToAmount(groupInput(e.target.value))} />
              {suggested ? (
                <button className="hint-btn" onClick={() => setToAmount(groupInput(String(suggested)))}>
                  Markaziy bank kursi bo'yicha: {fmtMoney(suggested, toAccount.currency)} (bosib qo'llang)
                </button>
              ) : null}
            </Field>
          ) : null}
        </>
      ) : (
        <Field label="Toifa">
          {typeCategories.length ? (
            <div className="cat-grid">
              {typeCategories.map((c) => (
                <button key={c.id} className={cx("cat-tile", c.id === categoryId && "active")} onClick={() => { haptic("select"); setCategoryId(c.id); }}>
                  <span className="cat-emoji">{c.icon || "•"}</span>
                  <span className="cat-name">{c.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="muted">Toifalar yo'q. Profil → Toifalar bo'limidan qo'shing.</div>
          )}
        </Field>
      )}

      <Field label="Sana">
        <div className="date-row">
          <Chip active={date === todayYmd()} onClick={() => setDate(todayYmd())}>Bugun</Chip>
          <Chip active={date === addDaysYmd(todayYmd(), -1)} onClick={() => setDate(addDaysYmd(todayYmd(), -1))}>Kecha</Chip>
          <input type="date" className="input date-input" value={date} max={todayYmd()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </Field>

      <Field label="Izoh">
        <input className="input" placeholder="Ixtiyoriy: masalan, mijoz ismi" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Sheet>
  );
}
