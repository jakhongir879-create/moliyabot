import { fmtMoney, timeOf } from "../lib/format";
import { cx } from "./common";

const FALLBACK_ICON = { INCOME: "💰", EXPENSE: "💸", TRANSFER: "🔁" };

// Bitta operatsiya qatori (ro'yxatlarda)
export default function TxRow({ tx, onClick, showTime = true, compact = false }) {
  const transfer = tx.type === "TRANSFER";
  const income = tx.type === "INCOME";
  const title = transfer
    ? `${tx.account?.name || "?"} → ${tx.toAccount?.name || "?"}`
    : tx.category?.name || "Toifasiz";
  const subParts = [];
  if (tx.note) subParts.push(tx.note);
  else if (!transfer && tx.account) subParts.push(tx.account.name);
  if (tx.note && !transfer && tx.account) subParts.push(tx.account.name);
  if (showTime) subParts.push(timeOf(tx.date));

  return (
    <button className={cx("row tx-row", compact && "compact")} onClick={onClick}>
      <span className={cx("tx-icon", `t-${tx.type.toLowerCase()}`)}>{tx.category?.icon || FALLBACK_ICON[tx.type]}</span>
      <span className="row-main">
        <span className="row-title">{title}</span>
        <span className="row-sub">{subParts.join(" · ")}</span>
      </span>
      <span className={cx("row-amount num", transfer ? "neutral" : income ? "pos" : "neg")}>
        {transfer ? fmtMoney(tx.amount, tx.currency) : fmtMoney(income ? tx.amount : -tx.amount, tx.currency, { sign: true })}
      </span>
    </button>
  );
}
