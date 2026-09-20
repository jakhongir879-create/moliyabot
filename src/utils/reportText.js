// Telegram uchun tayyor (HTML) hisobot matnlari
const { esc } = require("./html");
const { formatMoney } = require("./money");
const { round2 } = require("./money");

const changeText = (pct) => {
  if (pct === null || pct === undefined) return "";
  if (pct === 0) return "0%";
  return `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
};

function renderReport(report, { title = "Hisobot" } = {}) {
  const lines = [`📊 <b>${esc(title)}</b>`, `<i>${esc(report.range.label)}</i>`, ""];
  const codes = report.currencies.filter((c) => report.data[c].count > 0);

  if (!codes.length) {
    lines.push("Bu davrda operatsiyalar bo'lmadi.");
    return lines.join("\n");
  }

  for (const code of codes) {
    const d = report.data[code];
    if (codes.length > 1) lines.push(`<b>— ${code} —</b>`);
    lines.push(`🟢 Kirim: <b>${formatMoney(d.income, code)}</b>${d.change.income !== null ? `  <i>${changeText(d.change.income)}</i>` : ""}`);
    lines.push(`🔴 Chiqim: <b>${formatMoney(d.expense, code)}</b>${d.change.expense !== null ? `  <i>${changeText(d.change.expense)}</i>` : ""}`);
    lines.push(`${d.profit >= 0 ? "📈" : "📉"} Foyda: <b>${formatMoney(d.profit, code, { sign: true })}</b>`);

    const top = d.byCategory.expense.slice(0, 3);
    if (top.length) {
      lines.push("", "<b>Eng katta chiqimlar:</b>");
      for (const c of top) {
        lines.push(`• ${esc(c.icon || "")} ${esc(c.name)} — ${formatMoney(c.total, code)} <i>(${c.percent}%)</i>`);
      }
    }
    if (d.excluded.income || d.excluded.expense) {
      lines.push(
        "",
        `<i>ℹ️ Qarz harakati (foydaga kirmagan): +${formatMoney(d.excluded.income, code)} / −${formatMoney(d.excluded.expense, code)}</i>`
      );
    }
    lines.push("");
  }
  if (report.range.compareLabel) lines.push(`<i>▲▼ foizlar ${esc(report.range.compareLabel)}</i>`);
  return lines.join("\n").trim();
}

function renderBalances(accounts, { totalUZS, missingRates = [] } = {}) {
  if (!accounts.length) return "💰 <b>Hisoblar</b>\n\nHali hisob qo'shilmagan.";

  const lines = ["💰 <b>Hisoblar qoldig'i</b>", ""];
  const totals = {};
  for (const a of accounts) {
    lines.push(`${esc(a.icon || "💼")} ${esc(a.name)} — <b>${formatMoney(a.balance, a.currency)}</b>`);
    totals[a.currency] = round2((totals[a.currency] || 0) + a.balance);
  }

  const codes = Object.keys(totals);
  lines.push("");
  if (codes.length === 1) {
    lines.push(`<b>Jami:</b> ${formatMoney(totals[codes[0]], codes[0])}`);
  } else {
    lines.push(`<b>Jami:</b> ${codes.map((c) => formatMoney(totals[c], c)).join(" + ")}`);
    lines.push(`<i>≈ ${formatMoney(totalUZS, "UZS")} (Markaziy bank kursi bo'yicha)</i>`);
    if (missingRates.length) lines.push(`<i>Kursi topilmagan: ${missingRates.join(", ")}</i>`);
  }
  return lines.join("\n");
}

function debtLine(d) {
  const who = esc(d.personName);
  let due = "";
  if (d.dueInDays !== null && d.dueInDays !== undefined) {
    if (d.dueInDays < 0) due = ` — ⚠️ ${Math.abs(d.dueInDays)} kun kechikdi`;
    else if (d.dueInDays === 0) due = " — ⏰ bugun";
    else if (d.dueInDays === 1) due = " — ⏰ ertaga";
    else due = ` — ${d.dueInDays} kun qoldi`;
  }
  return `• ${who}: <b>${formatMoney(d.remaining, d.currency)}</b>${due}`;
}

function renderDebtSummary(summary) {
  const fmt = (byCur) => {
    const entries = Object.entries(byCur);
    return entries.length ? entries.map(([c, v]) => formatMoney(v, c)).join(" + ") : "—";
  };
  const lines = [
    "🤝 <b>Qarzlar</b>",
    "",
    `📥 Menga qarzdor (${summary.counts.RECEIVABLE} ta): <b>${fmt(summary.totals.RECEIVABLE)}</b>`,
    `📤 Men qarzdorman (${summary.counts.PAYABLE} ta): <b>${fmt(summary.totals.PAYABLE)}</b>`,
  ];
  if (summary.overdue) lines.push(`⚠️ Muddati o'tgan: <b>${summary.overdue} ta</b>`);
  if (summary.dueSoon.length) {
    lines.push("", "<b>Muddati yaqin:</b>");
    for (const d of summary.dueSoon) lines.push(debtLine(d));
  }
  return lines.join("\n");
}

function renderDebtReminder(debts) {
  const receivable = debts.filter((d) => d.type === "RECEIVABLE");
  const payable = debts.filter((d) => d.type === "PAYABLE");
  const lines = ["⏰ <b>Qarzlar eslatmasi</b>"];
  if (receivable.length) {
    lines.push("", "📥 <b>Sizga to'lashlari kerak:</b>");
    for (const d of receivable.slice(0, 10)) lines.push(debtLine(d));
  }
  if (payable.length) {
    lines.push("", "📤 <b>Siz to'lashingiz kerak:</b>");
    for (const d of payable.slice(0, 10)) lines.push(debtLine(d));
  }
  return lines.join("\n");
}

module.exports = { renderReport, renderBalances, renderDebtSummary, renderDebtReminder, debtLine };
