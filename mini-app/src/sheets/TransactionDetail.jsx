import { Pencil, Repeat, Trash2 } from "lucide-react";
import Sheet from "../ui/Sheet";
import { cx } from "../ui/common";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useAction } from "../lib/hooks";
import { api } from "../lib/api";
import { fmtDate, fmtMoney, timeOf } from "../lib/format";
import { TYPE_LABEL } from "../lib/constants";

const FALLBACK_ICON = { INCOME: "💰", EXPENSE: "💸", TRANSFER: "🔁" };

export default function TransactionDetail({ sheetId, closing, tx }) {
  const { perms, me } = useApp();
  const ui = useUI();
  const run = useAction();

  const income = tx.type === "INCOME";
  const transfer = tx.type === "TRANSFER";
  const ownAndFresh = tx.createdById === me?.id && Date.now() - new Date(tx.createdAt).getTime() < 15 * 60 * 1000;
  const canEdit = perms.editTransactions && !tx.locked;
  const canDelete = !tx.locked && (perms.editTransactions || ownAndFresh);

  const remove = async () => {
    const ok = await ui.confirm({
      title: "Operatsiyani o'chirish",
      message: `${TYPE_LABEL[tx.type]} — ${fmtMoney(tx.amount, tx.currency)} o'chiriladi. Hisob qoldig'i qayta hisoblanadi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await run(() => api(`/transactions/${tx.id}`, { method: "DELETE" }), { success: "Operatsiya o'chirildi" });
      ui.close(sheetId);
    } catch {
      /* xabar allaqachon ko'rsatilgan */
    }
  };

  const edit = () => {
    ui.close(sheetId);
    setTimeout(() => ui.open("txForm", { tx }), 230);
  };

  const repeat = () => {
    ui.close(sheetId);
    setTimeout(
      () =>
        ui.open("txForm", {
          preset: { type: tx.type, amount: tx.amount, accountId: tx.accountId, categoryId: tx.categoryId, note: tx.note || "" },
        }),
      230
    );
  };

  const rows = [
    ["Tur", TYPE_LABEL[tx.type]],
    [transfer ? "Qaysi hisobdan" : "Hisob", tx.account ? `${tx.account.icon || ""} ${tx.account.name}` : "—"],
    transfer ? ["Qaysi hisobga", tx.toAccount ? `${tx.toAccount.icon || ""} ${tx.toAccount.name}` : "—"] : null,
    transfer && tx.toAmount && tx.toAccount?.currency !== tx.currency ? ["Qabul qilindi", fmtMoney(tx.toAmount, tx.toAccount.currency)] : null,
    !transfer ? ["Toifa", tx.category ? `${tx.category.icon || ""} ${tx.category.name}` : "—"] : null,
    ["Sana", `${fmtDate(tx.date)}, ${timeOf(tx.date)}`],
    tx.note ? ["Izoh", tx.note] : null,
    tx.createdBy ? ["Kiritdi", tx.createdBy.name] : null,
  ].filter(Boolean);

  return (
    <Sheet
      title={TYPE_LABEL[tx.type]}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <div className="foot-actions">
          {canDelete ? (
            <button className="btn btn-danger-soft" onClick={remove} aria-label="O'chirish">
              <Trash2 size={18} />
            </button>
          ) : null}
          {perms.createTransfers || tx.type !== "TRANSFER" ? (
            <button className="btn btn-soft" onClick={repeat}>
              <Repeat size={17} /> Takrorlash
            </button>
          ) : null}
          {canEdit ? (
            <button className="btn btn-primary" onClick={edit}>
              <Pencil size={17} /> Tahrirlash
            </button>
          ) : null}
        </div>
      }
    >
      <div className="detail-hero">
        <div className={cx("detail-icon", `t-${tx.type.toLowerCase()}`)}>{tx.category?.icon || FALLBACK_ICON[tx.type]}</div>
        <div className={cx("detail-amount num", transfer ? "neutral" : income ? "pos" : "neg")}>
          {transfer ? fmtMoney(tx.amount, tx.currency) : fmtMoney(income ? tx.amount : -tx.amount, tx.currency, { sign: true })}
        </div>
        <div className="muted">{transfer ? "Hisoblar orasida o'tkazma" : tx.category?.name || "Toifasiz"}</div>
      </div>

      <div className="kv">
        {rows.map(([k, v]) => (
          <div className="kv-row" key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>

      {tx.locked ? (
        <div className="notice">🔒 Bu operatsiya qarz bilan bog'langan. O'zgartirish uchun «Qarzlar» bo'limiga o'ting.</div>
      ) : null}
    </Sheet>
  );
}
