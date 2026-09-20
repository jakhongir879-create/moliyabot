// Qarzlar (nasiya daftari) va ular bo'yicha to'lovlar
const { prisma } = require("../database/connection");
const config = require("../config/default");
const Category = require("./Category");
const User = require("./User");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { num, round2 } = require("../utils/money");
const { parseYMD, resolveEntryDate, daysUntil } = require("../utils/date");

const USER_SELECT = { id: true, firstName: true, lastName: true, username: true, telegramId: true };

const INCLUDE = {
  payments: {
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: {
      transaction: { select: { account: { select: { id: true, name: true, icon: true } } } },
      createdBy: { select: USER_SELECT },
    },
  },
  createdBy: { select: USER_SELECT },
};

function serialize(d) {
  const amount = num(d.amount);
  const paid = round2(d.payments.reduce((sum, p) => sum + Number(p.amount), 0));
  const remaining = round2(Math.max(amount - paid, 0));
  const dueInDays = d.dueDate ? daysUntil(d.dueDate) : null;
  return {
    id: d.id,
    type: d.type,
    personName: d.personName,
    phone: d.phone,
    amount,
    currency: d.currency,
    paid,
    remaining,
    dueDate: d.dueDate ? d.dueDate.toISOString() : null,
    dueInDays,
    overdue: d.status === "OPEN" && dueInDays !== null && dueInDays < 0,
    note: d.note,
    moneyMoved: d.moneyMoved,
    status: d.status,
    closedAt: d.closedAt ? d.closedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    createdBy: d.createdBy ? { id: d.createdBy.id, name: User.fullName(d.createdBy) } : null,
    payments: d.payments.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      date: p.date.toISOString(),
      note: p.note,
      account: p.transaction && p.transaction.account ? p.transaction.account : null,
      createdBy: p.createdBy ? { id: p.createdBy.id, name: User.fullName(p.createdBy) } : null,
    })),
  };
}

function cleanName(value) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) throw badRequest("Ism yoki nomni kiriting");
  return s.slice(0, 100);
}

function cleanPhone(value) {
  const s = String(value || "").replace(/[^\d+\-() ]/g, "").trim();
  return s ? s.slice(0, 30) : null;
}

function cleanNote(value) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 300) : null;
}

function parseDue(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = parseYMD(value);
  if (!d) throw badRequest("Muddat sanasi noto'g'ri");
  return d;
}

// Muddati yaqin / o'tgan qarzlar tartibda chiqadi
function sortDebts(list) {
  return list.sort((a, b) => {
    if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
    if (a.status === "CLOSED") return new Date(b.closedAt || 0) - new Date(a.closedAt || 0);
    const da = a.dueInDays === null ? Number.POSITIVE_INFINITY : a.dueInDays;
    const db = b.dueInDays === null ? Number.POSITIVE_INFINITY : b.dueInDays;
    if (da !== db) return da - db;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

async function list({ type, status, q } = {}) {
  const rows = await prisma.debt.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(status && status !== "ALL" ? { status } : {}),
      ...(q && String(q).trim()
        ? {
            OR: [
              { personName: { contains: String(q).trim(), mode: "insensitive" } },
              { phone: { contains: String(q).trim() } },
              { note: { contains: String(q).trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: INCLUDE,
  });
  return sortDebts(rows.map(serialize));
}

async function getById(id, db = prisma) {
  const row = await db.debt.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw notFound("Qarz topilmadi");
  return serialize(row);
}

async function create(input, actor) {
  const personName = cleanName(input.personName);
  const amount = round2(input.amount);
  if (!(amount > 0)) throw badRequest("Summa noldan katta bo'lishi kerak");
  if (!config.currencies[input.currency]) throw badRequest("Valyuta qo'llab-quvvatlanmaydi");
  const dueDate = parseDue(input.dueDate);
  const createdById = actor && actor.userId ? actor.userId : null;

  const created = await prisma.$transaction(async (tx) => {
    let principalTxId = null;

    if (input.moneyMoved) {
      if (!input.accountId) throw badRequest("Pul qaysi hisobdan o'tganini tanlang");
      const account = await tx.account.findUnique({ where: { id: input.accountId } });
      if (!account || account.isArchived) throw notFound("Hisob topilmadi");
      if (account.currency !== input.currency) throw badRequest("Hisob valyutasi qarz valyutasiga mos emas");
      const category = await Category.bySystemKey(input.type === "RECEIVABLE" ? "DEBT_GIVEN" : "DEBT_TAKEN", tx);
      const principal = await tx.transaction.create({
        data: {
          type: input.type === "RECEIVABLE" ? "EXPENSE" : "INCOME",
          amount,
          currency: input.currency,
          accountId: account.id,
          categoryId: category.id,
          note: `${input.type === "RECEIVABLE" ? "Qarz berildi" : "Qarz olindi"}: ${personName}`.slice(0, 300),
          date: new Date(),
          createdById,
        },
      });
      principalTxId = principal.id;
    }

    return tx.debt.create({
      data: {
        type: input.type,
        personName,
        phone: cleanPhone(input.phone),
        amount,
        currency: input.currency,
        dueDate: dueDate || null,
        note: cleanNote(input.note),
        moneyMoved: Boolean(input.moneyMoved),
        principalTxId,
        createdById,
      },
      include: INCLUDE,
    });
  });

  return serialize(created);
}

async function update(id, patch) {
  const existing = await prisma.debt.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) throw notFound("Qarz topilmadi");
  const data = {};

  if (patch.personName !== undefined) data.personName = cleanName(patch.personName);
  if (patch.phone !== undefined) data.phone = cleanPhone(patch.phone);
  if (patch.note !== undefined) data.note = cleanNote(patch.note);
  if (patch.dueDate !== undefined) data.dueDate = parseDue(patch.dueDate);

  if (patch.amount !== undefined) {
    const amount = round2(patch.amount);
    if (!(amount > 0)) throw badRequest("Summa noldan katta bo'lishi kerak");
    if (amount !== num(existing.amount)) {
      if (existing.moneyMoved) {
        throw conflict("Pul harakati bilan yozilgan qarz summasini o'zgartirib bo'lmaydi. Uni o'chirib, qaytadan kiriting.");
      }
      const paid = existing.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (amount < paid - 0.001) throw badRequest("Summa allaqachon to'langan qismdan kam bo'lishi mumkin emas");
      data.amount = amount;
      if (amount - paid <= 0.001) {
        data.status = "CLOSED";
        data.closedAt = existing.closedAt || new Date();
      } else {
        data.status = "OPEN";
        data.closedAt = null;
      }
    }
  }

  const row = await prisma.debt.update({ where: { id }, data, include: INCLUDE });
  return { before: serialize(existing), after: serialize(row) };
}

async function addPayment(debtId, input, actor) {
  const createdById = actor && actor.userId ? actor.userId : null;

  const result = await prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findUnique({ where: { id: debtId }, include: { payments: true } });
    if (!debt) throw notFound("Qarz topilmadi");
    if (debt.status === "CLOSED") throw conflict("Bu qarz allaqachon yopilgan");

    const paid = debt.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = round2(Number(debt.amount) - paid);
    const amount = round2(input.amount);
    if (!(amount > 0)) throw badRequest("Summa noldan katta bo'lishi kerak");
    if (amount > remaining + 0.001) throw badRequest(`To'lov summasi qarz qoldig'idan (${remaining}) oshib ketdi`);

    const account = await tx.account.findUnique({ where: { id: input.accountId } });
    if (!account || account.isArchived) throw notFound("Hisob topilmadi");
    if (account.currency !== debt.currency) {
      throw badRequest(`Hisob valyutasi qarz valyutasiga (${debt.currency}) mos emas`);
    }

    const date = resolveEntryDate(input.date);
    if (!date) throw badRequest("Sana noto'g'ri yoki kelajakda");

    const receivable = debt.type === "RECEIVABLE";
    let key;
    if (debt.moneyMoved) key = receivable ? "DEBT_COLLECTED" : "DEBT_REPAID";
    else key = receivable ? "CREDIT_COLLECTED" : "CREDIT_PAID";
    const category = await Category.bySystemKey(key, tx);

    const transaction = await tx.transaction.create({
      data: {
        type: receivable ? "INCOME" : "EXPENSE",
        amount,
        currency: debt.currency,
        accountId: account.id,
        categoryId: category.id,
        note: `${receivable ? "Qarz qaytdi" : "Qarz to'landi"}: ${debt.personName}`.slice(0, 300),
        date,
        createdById,
      },
    });

    await tx.debtPayment.create({
      data: {
        debtId,
        amount,
        date,
        note: cleanNote(input.note),
        transactionId: transaction.id,
        createdById,
      },
    });

    if (round2(remaining - amount) <= 0.001) {
      await tx.debt.update({ where: { id: debtId }, data: { status: "CLOSED", closedAt: new Date() } });
    }
    return tx.debt.findUnique({ where: { id: debtId }, include: INCLUDE });
  });

  return serialize(result);
}

async function removePayment(debtId, paymentId) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.debtPayment.findFirst({ where: { id: paymentId, debtId } });
    if (!payment) throw notFound("To'lov topilmadi");
    await tx.debtPayment.delete({ where: { id: paymentId } });
    if (payment.transactionId) {
      await tx.transaction.delete({ where: { id: payment.transactionId } }).catch(() => null);
    }
    await tx.debt.update({ where: { id: debtId }, data: { status: "OPEN", closedAt: null } });
    return tx.debt.findUnique({ where: { id: debtId }, include: INCLUDE });
  });
  return serialize(result);
}

// Qarzni, uning to'lovlarini va bog'langan kassa operatsiyalarini o'chiradi
async function remove(id) {
  const debt = await prisma.debt.findUnique({ where: { id }, include: INCLUDE });
  if (!debt) throw notFound("Qarz topilmadi");
  const snapshot = serialize(debt);

  await prisma.$transaction(async (tx) => {
    const payments = await tx.debtPayment.findMany({ where: { debtId: id }, select: { transactionId: true } });
    const txIds = payments.map((p) => p.transactionId).filter(Boolean);
    if (debt.principalTxId) txIds.push(debt.principalTxId);
    await tx.debt.delete({ where: { id } });
    if (txIds.length) await tx.transaction.deleteMany({ where: { id: { in: txIds } } });
  });

  return snapshot;
}

// Ochiq qarzlar bo'yicha umumiy ko'rsatkichlar
async function summary() {
  const open = await prisma.debt.findMany({
    where: { status: "OPEN" },
    include: { payments: { select: { amount: true } } },
  });

  const totals = { RECEIVABLE: {}, PAYABLE: {} };
  const counts = { RECEIVABLE: 0, PAYABLE: 0 };
  let overdue = 0;
  const upcoming = [];

  for (const d of open) {
    const paid = d.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = round2(Number(d.amount) - paid);
    if (remaining <= 0) continue;
    totals[d.type][d.currency] = round2((totals[d.type][d.currency] || 0) + remaining);
    counts[d.type] += 1;
    const dueInDays = d.dueDate ? daysUntil(d.dueDate) : null;
    if (dueInDays !== null && dueInDays < 0) overdue += 1;
    if (dueInDays !== null && dueInDays <= 7) {
      upcoming.push({
        id: d.id,
        type: d.type,
        personName: d.personName,
        phone: d.phone,
        currency: d.currency,
        remaining,
        dueDate: d.dueDate.toISOString(),
        dueInDays,
      });
    }
  }
  upcoming.sort((a, b) => a.dueInDays - b.dueInDays);

  return { totals, counts, overdue, dueSoon: upcoming.slice(0, 6) };
}

// Eslatma yuborish uchun: muddati o'tgan yoki eng ko'pi bilan ertaga tugaydigan qarzlar
async function dueForReminder(maxDays = 1) {
  const open = await prisma.debt.findMany({
    where: { status: "OPEN", dueDate: { not: null } },
    include: { payments: { select: { amount: true } } },
  });
  const out = [];
  for (const d of open) {
    const dueInDays = daysUntil(d.dueDate);
    if (dueInDays > maxDays) continue;
    const paid = d.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = round2(Number(d.amount) - paid);
    if (remaining <= 0) continue;
    out.push({ id: d.id, type: d.type, personName: d.personName, currency: d.currency, remaining, dueInDays });
  }
  return out.sort((a, b) => a.dueInDays - b.dueInDays);
}

module.exports = {
  serialize,
  list,
  getById,
  create,
  update,
  addPayment,
  removePayment,
  remove,
  summary,
  dueForReminder,
};
