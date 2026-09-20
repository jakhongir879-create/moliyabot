// Excel (.xlsx) hisobot yaratish
const ExcelJS = require("exceljs");
const config = require("../config/default");
const Transaction = require("../models/Transaction");
const Debt = require("../models/Debt");
const { buildReport } = require("./report.service");
const D = require("../utils/date");

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
const NUM_FMT = "#,##0.00";

const TYPE_LABEL = { INCOME: "Kirim", EXPENSE: "Chiqim", TRANSFER: "O'tkazma" };

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  row.height = 22;
}

// Excel sanani UTC deb saqlaydi, shuning uchun Toshkent vaqtiga siljitamiz
const asLocalCell = (iso) => new Date(new Date(iso).getTime() + config.tzOffsetHours * D.HOUR);

function addSummarySheet(wb, report, { businessName }) {
  const ws = wb.addWorksheet("Xulosa", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 36 }, { width: 22 }, { width: 22 }, { width: 14 }];

  ws.addRow([businessName]).font = { bold: true, size: 16 };
  ws.addRow([`Davr: ${report.range.label}`]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([`Yaratilgan: ${D.formatDateTime(new Date())}`]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([]);

  const active = report.currencies.filter((c) => report.data[c].count > 0);
  if (!active.length) {
    ws.addRow(["Bu davrda operatsiyalar bo'lmadi."]);
    return;
  }

  for (const code of active) {
    const d = report.data[code];
    styleHeader(ws.addRow([`Valyuta: ${code}`, "Summa"]));

    const income = ws.addRow(["Kirim", d.income]);
    const expense = ws.addRow(["Chiqim", d.expense]);
    const profit = ws.addRow(["Foyda", d.profit]);
    income.getCell(2).font = { color: { argb: "FF15803D" }, bold: true };
    expense.getCell(2).font = { color: { argb: "FFB91C1C" }, bold: true };
    profit.getCell(1).font = { bold: true };
    profit.getCell(2).font = { bold: true, color: { argb: d.profit >= 0 ? "FF15803D" : "FFB91C1C" } };
    for (const r of [income, expense, profit]) r.getCell(2).numFmt = NUM_FMT;

    if (d.excluded.income || d.excluded.expense) {
      const note = ws.addRow([
        `Qarz harakati (foydaga kirmagan): +${d.excluded.income} / -${d.excluded.expense}`,
      ]);
      note.font = { italic: true, color: { argb: "FF6B7280" } };
    }

    for (const [kind, label] of [
      ["expense", "Chiqim toifalari"],
      ["income", "Kirim toifalari"],
    ]) {
      const list = d.byCategory[kind];
      if (!list.length) continue;
      ws.addRow([]);
      styleHeader(ws.addRow([label, "Summa", "Ulush (%)", "Soni"]));
      for (const c of list) {
        const row = ws.addRow([`${c.icon || ""} ${c.name}`.trim(), c.total, c.percent, c.count]);
        row.getCell(2).numFmt = NUM_FMT;
      }
    }
    ws.addRow([]);
    ws.addRow([]);
  }
}

function addTransactionsSheet(wb, txs) {
  const ws = wb.addWorksheet("Operatsiyalar", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "№", key: "n", width: 6 },
    { header: "Sana va vaqt", key: "date", width: 18 },
    { header: "Tur", key: "type", width: 11 },
    { header: "Hisob", key: "account", width: 22 },
    { header: "Toifa", key: "category", width: 26 },
    { header: "Kirim", key: "income", width: 16 },
    { header: "Chiqim", key: "expense", width: 16 },
    { header: "Valyuta", key: "currency", width: 9 },
    { header: "Izoh", key: "note", width: 40 },
    { header: "Kim kiritdi", key: "by", width: 20 },
  ];
  styleHeader(ws.getRow(1));

  txs.forEach((t, i) => {
    let account = t.account ? t.account.name : "";
    let note = t.note || "";
    if (t.type === "TRANSFER" && t.toAccount) {
      account = `${t.account.name} → ${t.toAccount.name}`;
      if (t.toAmount !== null && t.currency !== t.toAccount.currency) {
        note = `${note ? `${note} · ` : ""}${t.amount} ${t.currency} → ${t.toAmount} ${t.toAccount.currency}`;
      }
    }
    const row = ws.addRow({
      n: i + 1,
      date: asLocalCell(t.date),
      type: TYPE_LABEL[t.type],
      account,
      category: t.category ? `${t.category.icon || ""} ${t.category.name}`.trim() : "",
      income: t.type === "INCOME" ? t.amount : null,
      expense: t.type === "EXPENSE" ? t.amount : null,
      currency: t.currency,
      note,
      by: t.createdBy ? t.createdBy.name : "",
    });
    row.getCell("date").numFmt = "dd.mm.yyyy hh:mm";
    row.getCell("income").numFmt = NUM_FMT;
    row.getCell("expense").numFmt = NUM_FMT;
    row.getCell("income").font = { color: { argb: "FF15803D" } };
    row.getCell("expense").font = { color: { argb: "FFB91C1C" } };
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
}

function addDebtsSheet(wb, debts) {
  const ws = wb.addWorksheet("Qarzlar", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Tur", key: "type", width: 16 },
    { header: "Ism / nom", key: "person", width: 26 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "Summa", key: "amount", width: 16 },
    { header: "To'langan", key: "paid", width: 16 },
    { header: "Qoldiq", key: "remaining", width: 16 },
    { header: "Valyuta", key: "currency", width: 9 },
    { header: "Muddat", key: "due", width: 14 },
    { header: "Izoh", key: "note", width: 36 },
  ];
  styleHeader(ws.getRow(1));
  for (const d of debts) {
    const row = ws.addRow({
      type: d.type === "RECEIVABLE" ? "Menga qarzdor" : "Men qarzdorman",
      person: d.personName,
      phone: d.phone || "",
      amount: d.amount,
      paid: d.paid,
      remaining: d.remaining,
      currency: d.currency,
      due: d.dueDate ? D.formatShortDate(new Date(d.dueDate)) : "",
      note: d.note || "",
    });
    for (const k of ["amount", "paid", "remaining"]) row.getCell(k).numFmt = NUM_FMT;
    if (d.overdue) row.getCell("due").font = { color: { argb: "FFB91C1C" }, bold: true };
  }
}

// range: rangeForPeriod() natijasi; filters: Transaction.list filtrlari
async function buildWorkbook({ range, filters = {}, businessName = config.businessName, includeDebts = true }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moliya Bot";
  wb.created = new Date();

  const [report, txs, debts] = await Promise.all([
    buildReport(range),
    Transaction.listAll({ ...filters, from: range.from, to: range.to }),
    includeDebts ? Debt.list({ status: "OPEN" }) : [],
  ]);

  addSummarySheet(wb, report, { businessName });
  addTransactionsSheet(wb, txs);
  if (includeDebts) addDebtsSheet(wb, debts);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const last = D.addDays(range.to, -1);
  const filename = `moliya_${D.ymd(range.from)}_${D.ymd(last)}.xlsx`;
  return { buffer, filename, count: txs.length };
}

module.exports = { buildWorkbook };
