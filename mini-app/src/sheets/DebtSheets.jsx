import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Phone, Trash2 } from "lucide-react";
import Sheet from "../ui/Sheet";
import { AmountInput, Avatar, Badge, Chip, EmptyState, ErrorBox, Field, Segmented, Skeleton, Switch, cx } from "../ui/common";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useAction } from "../lib/hooks";
import { api } from "../lib/api";
import { CURRENCIES, addDaysYmd, dueInfo, fmtDate, fmtMoney, fmtYmd, groupInput, parseInput, todayYmd, ymd } from "../lib/format";

const TYPE_OPTIONS = [
  { value: "RECEIVABLE", label: "Menga qarzdor", tone: "income" },
  { value: "PAYABLE", label: "Men qarzdorman", tone: "expense" },
];

// ---------------------------------------------------------------
// Qarz qo'shish / tahrirlash
// ---------------------------------------------------------------
export function DebtForm({ sheetId, closing, debt, presetType }) {
  const { accounts } = useApp();
  const ui = useUI();
  const run = useAction();
  const editing = Boolean(debt);

  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const [type, setType] = useState(debt?.type ?? presetType ?? "RECEIVABLE");
  const [personName, setPersonName] = useState(debt?.personName ?? "");
  const [phone, setPhone] = useState(debt?.phone ?? "");
  const [amount, setAmount] = useState(debt ? groupInput(String(debt.amount)) : "");
  const [currency, setCurrency] = useState(debt?.currency ?? currencies[0] ?? "UZS");
  const [dueDate, setDueDate] = useState(debt?.dueDate ? ymd(debt.dueDate) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [moneyMoved, setMoneyMoved] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [busy, setBusy] = useState(false);

  const matchingAccounts = accounts.filter((a) => a.currency === currency);
  const amountNum = parseInput(amount);
  const amountLocked = editing && debt.moneyMoved;
  const valid = personName.trim().length > 0 && amountNum > 0 && (!moneyMoved || accountId);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await run(
          () =>
            api(`/debts/${debt.id}`, {
              method: "PATCH",
              body: { personName: personName.trim(), phone: phone.trim(), dueDate: dueDate || null, note: note.trim(), ...(amountLocked ? {} : { amount: amountNum }) },
            }),
          { success: "Qarz yangilandi" }
        );
      } else {
        await run(
          () =>
            api("/debts", {
              method: "POST",
              body: {
                type,
                personName: personName.trim(),
                phone: phone.trim() || undefined,
                amount: amountNum,
                currency,
                dueDate: dueDate || undefined,
                note: note.trim() || undefined,
                moneyMoved,
                accountId: moneyMoved ? accountId : undefined,
              },
            }),
          { success: "Qarz qo'shildi" }
        );
      }
      ui.close(sheetId);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={editing ? "Qarzni tahrirlash" : "Yangi qarz"}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      tall
      footer={
        <button className="btn btn-primary btn-block btn-lg" disabled={!valid || busy} onClick={submit}>
          {busy ? "Saqlanmoqda..." : editing ? "Saqlash" : `Qarz qo'shish${amountNum > 0 ? ` — ${fmtMoney(amountNum, currency)}` : ""}`}
        </button>
      }
    >
      {!editing ? <Segmented options={TYPE_OPTIONS} value={type} onChange={setType} /> : null}

      <Field label={type === "RECEIVABLE" ? "Kim sizga qarzdor?" : "Kimga qarzdorsiz?"}>
        <input className="input" placeholder="Ism yoki tashkilot nomi" maxLength={100} value={personName} onChange={(e) => setPersonName(e.target.value)} autoFocus={!editing} />
      </Field>

      <Field label="Telefon (ixtiyoriy)">
        <input className="input" inputMode="tel" placeholder="+998 90 123 45 67" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>

      <div className="amount-wrap">
        <AmountInput value={amount} onChange={setAmount} currency={currency} />
        {!amountLocked ? (
          <div className="amount-tools">
            <button className="mini-btn" onClick={() => setAmount((a) => (a ? groupInput(`${a.replace(/\s/g, "")}000`) : ""))}>+ 000</button>
          </div>
        ) : (
          <div className="muted small center">Pul harakati bilan yozilgan qarz summasini o'zgartirib bo'lmaydi</div>
        )}
      </div>

      {!editing && currencies.length > 1 ? (
        <Field label="Valyuta">
          <div className="chip-scroll">
            {currencies.map((c) => (
              <Chip key={c} active={c === currency} onClick={() => { setCurrency(c); setAccountId(null); }}>
                {CURRENCIES[c]?.label || c} ({c})
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}

      <Field label="To'lash muddati (ixtiyoriy)">
        <div className="date-row">
          <Chip active={dueDate === addDaysYmd(todayYmd(), 7)} onClick={() => setDueDate(addDaysYmd(todayYmd(), 7))}>1 hafta</Chip>
          <Chip active={dueDate === addDaysYmd(todayYmd(), 14)} onClick={() => setDueDate(addDaysYmd(todayYmd(), 14))}>2 hafta</Chip>
          <Chip active={dueDate === addDaysYmd(todayYmd(), 30)} onClick={() => setDueDate(addDaysYmd(todayYmd(), 30))}>1 oy</Chip>
          <input type="date" className="input date-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </Field>

      <Field label="Izoh (ixtiyoriy)">
        <input className="input" placeholder="Masalan: tovar nasiyaga olingan" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {!editing ? (
        <div className="switch-card">
          <div className="switch-row">
            <div>
              <b>{type === "RECEIVABLE" ? "Pulni hisobimdan berdim" : "Pulni hisobimga oldim"}</b>
              <div className="muted small">
                {type === "RECEIVABLE"
                  ? "Yoqilsa, tanlangan hisobdan shu summa chiqim qilinadi."
                  : "Yoqilsa, tanlangan hisobga shu summa kirim qilinadi."}
                {" "}Nasiya savdo/xarid bo'lsa, o'chirib qo'ying.
              </div>
            </div>
            <Switch checked={moneyMoved} onChange={setMoneyMoved} />
          </div>
          {moneyMoved ? (
            matchingAccounts.length ? (
              <div className="chip-scroll" style={{ marginTop: 12 }}>
                {matchingAccounts.map((a) => (
                  <Chip key={a.id} active={a.id === accountId} onClick={() => setAccountId(a.id)}>
                    <span>{a.icon}</span> {a.name}
                  </Chip>
                ))}
              </div>
            ) : (
              <div className="muted small" style={{ marginTop: 10 }}>Bu valyutada hisob yo'q.</div>
            )
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------
// To'lov qabul qilish / to'lash
// ---------------------------------------------------------------
export function PaymentForm({ sheetId, closing, debt }) {
  const { accounts } = useApp();
  const ui = useUI();
  const run = useAction();
  const receivable = debt.type === "RECEIVABLE";

  const matching = accounts.filter((a) => a.currency === debt.currency);
  const [amount, setAmount] = useState(groupInput(String(debt.remaining)));
  const [accountId, setAccountId] = useState(matching[0]?.id ?? null);
  const [date, setDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const amountNum = parseInput(amount);
  const valid = amountNum > 0 && amountNum <= debt.remaining + 0.001 && accountId;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await run(
        () => api(`/debts/${debt.id}/payments`, { method: "POST", body: { amount: amountNum, accountId, date, note: note.trim() || undefined } }),
        { success: amountNum >= debt.remaining - 0.001 ? "Qarz to'liq yopildi 🎉" : "To'lov yozildi" }
      );
      ui.close(sheetId);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={receivable ? "To'lov qabul qilish" : "To'lov qilish"}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <button className="btn btn-primary btn-block btn-lg" disabled={!valid || busy} onClick={submit}>
          {busy ? "Saqlanmoqda..." : `${receivable ? "Qabul qilish" : "To'lash"}${amountNum > 0 ? ` — ${fmtMoney(amountNum, debt.currency)}` : ""}`}
        </button>
      }
    >
      <div className="muted center">
        {debt.personName} · qoldiq <b>{fmtMoney(debt.remaining, debt.currency)}</b>
      </div>

      <div className="amount-wrap">
        <AmountInput value={amount} onChange={setAmount} currency={debt.currency} autoFocus />
        <div className="amount-tools">
          <button className="mini-btn" onClick={() => setAmount(groupInput(String(debt.remaining)))}>Hammasi</button>
          <button className="mini-btn" onClick={() => setAmount(groupInput(String(Math.round((debt.remaining / 2) * 100) / 100)))}>Yarmi</button>
        </div>
        {amountNum > debt.remaining + 0.001 ? <div className="field-error center">Summa qoldiqdan oshib ketdi</div> : null}
      </div>

      <Field label={receivable ? "Qaysi hisobga tushdi?" : "Qaysi hisobdan to'landi?"}>
        {matching.length ? (
          <div className="chip-scroll">
            {matching.map((a) => (
              <Chip key={a.id} active={a.id === accountId} onClick={() => setAccountId(a.id)}>
                <span>{a.icon}</span> {a.name}
              </Chip>
            ))}
          </div>
        ) : (
          <div className="muted">Bu valyutada hisob yo'q. Avval hisob qo'shing.</div>
        )}
      </Field>

      <Field label="Sana">
        <input type="date" className="input" value={date} max={todayYmd()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      <Field label="Izoh (ixtiyoriy)">
        <input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: naqd berdi" />
      </Field>
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Qarz tafsiloti
// ---------------------------------------------------------------
export function DebtDetail({ sheetId, closing, debtId, initial }) {
  const { perms } = useApp();
  const ui = useUI();
  const run = useAction();

  const { data, error, refetch } = useQuery({ queryKey: ["debt", debtId], queryFn: () => api(`/debts/${debtId}`), initialData: initial });
  const debt = data;

  const removeDebt = async () => {
    const ok = await ui.confirm({
      title: "Qarzni o'chirish",
      message: "Qarz va u bilan bog'liq barcha to'lovlar (kassadagi yozuvlari bilan birga) o'chiriladi. Davom etasizmi?",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await run(() => api(`/debts/${debtId}`, { method: "DELETE" }), { success: "Qarz o'chirildi" });
      ui.close(sheetId);
    } catch {
      /* xabar ko'rsatilgan */
    }
  };

  const removePayment = async (p) => {
    const ok = await ui.confirm({
      title: "To'lovni bekor qilish",
      message: `${fmtMoney(p.amount, debt.currency)} to'lovi va uning kassadagi yozuvi o'chiriladi.`,
      confirmText: "Bekor qilish",
      danger: true,
    });
    if (!ok) return;
    try {
      await run(() => api(`/debts/${debtId}/payments/${p.id}`, { method: "DELETE" }), { success: "To'lov bekor qilindi" });
    } catch {
      /* xabar ko'rsatilgan */
    }
  };

  if (!debt) {
    return (
      <Sheet title="Qarz" closing={closing} onClose={() => ui.close(sheetId)}>
        {error ? <ErrorBox error={error} onRetry={refetch} /> : <Skeleton h={180} r={18} />}
      </Sheet>
    );
  }

  const receivable = debt.type === "RECEIVABLE";
  const due = dueInfo(debt);
  const progress = debt.amount ? Math.min(100, Math.round((debt.paid / debt.amount) * 100)) : 0;

  return (
    <Sheet
      title={receivable ? "Menga qarzdor" : "Men qarzdorman"}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <div className="foot-actions">
          <button className="btn btn-danger-soft" onClick={removeDebt} aria-label="O'chirish">
            <Trash2 size={18} />
          </button>
          <button className="btn btn-soft" onClick={() => ui.open("debtForm", { debt })} aria-label="Tahrirlash">
            <Pencil size={17} /> Tahrirlash
          </button>
          {debt.status === "OPEN" ? (
            <button className="btn btn-primary" onClick={() => ui.open("paymentForm", { debt })}>
              {receivable ? "To'lov qabul qilish" : "To'lov qilish"}
            </button>
          ) : null}
        </div>
      }
    >
      <div className="debt-head">
        <Avatar name={debt.personName} size={52} />
        <div className="debt-head-main">
          <div className="debt-name">{debt.personName}</div>
          {debt.phone ? (
            <a className="debt-phone" href={`tel:${debt.phone.replace(/[^\d+]/g, "")}`}>
              <Phone size={14} /> {debt.phone}
            </a>
          ) : (
            <span className="muted small">Telefon kiritilmagan</span>
          )}
        </div>
        <Badge tone={due.tone === "late" ? "danger" : due.tone === "soon" ? "warn" : due.tone === "done" ? "success" : "neutral"}>{due.text}</Badge>
      </div>

      <div className="debt-amount-card">
        <div className="muted small">Qoldiq</div>
        <div className={cx("debt-remaining num", receivable ? "pos" : "neg")}>{fmtMoney(debt.remaining, debt.currency)}</div>
        <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="debt-split">
          <span>Jami <b className="num">{fmtMoney(debt.amount, debt.currency)}</b></span>
          <span>To'langan <b className="num">{fmtMoney(debt.paid, debt.currency)}</b></span>
        </div>
      </div>

      <div className="kv">
        {debt.dueDate ? <div className="kv-row"><span>Muddat</span><b>{fmtDate(debt.dueDate)}</b></div> : null}
        <div className="kv-row"><span>Yozilgan sana</span><b>{fmtDate(debt.createdAt)}</b></div>
        {debt.note ? <div className="kv-row"><span>Izoh</span><b>{debt.note}</b></div> : null}
        {debt.moneyMoved ? <div className="kv-row"><span>Pul harakati</span><b>Hisob orqali o'tgan</b></div> : null}
        {debt.createdBy ? <div className="kv-row"><span>Kiritdi</span><b>{debt.createdBy.name}</b></div> : null}
      </div>

      <div className="section-mini">To'lovlar tarixi</div>
      {debt.payments.length ? (
        <div className="card-list">
          {[...debt.payments].reverse().map((p) => (
            <div className="row pay-row" key={p.id}>
              <span className="tx-icon t-income">✓</span>
              <span className="row-main">
                <span className="row-title num">{fmtMoney(p.amount, debt.currency)}</span>
                <span className="row-sub">{fmtDate(p.date)}{p.account ? ` · ${p.account.name}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
              </span>
              <button className="icon-btn" onClick={() => removePayment(p)} aria-label="To'lovni o'chirish">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🧾" title="To'lovlar hali yo'q" text={receivable ? "Mijoz to'lov qilganda «To'lov qabul qilish» tugmasini bosing." : "To'lov qilganingizda «To'lov qilish» tugmasini bosing."} />
      )}
    </Sheet>
  );
}
