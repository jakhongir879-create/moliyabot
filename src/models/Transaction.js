// Kirim / Chiqim / O'tkazma operatsiyalari
const { prisma } = require("../database/connection");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { num, round2 } = require("../utils/money");
const { resolveEntryDate, ymd } = require("../utils/date");
const User = require("./User");

const INCLUDE = {
  account: { select: { id: true, name: true, icon: true, currency: true } },
  toAccount: { select: { id: true, name: true, icon: true, currency: true } },
  category: { select: { id: true, name: true, icon: true, isSystem: true, excludeFromProfit: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, username: true, telegramId: true } },
  principalOf: { select: { id: true } },
  paymentOf: { select: { id: true, debtId: true } },
};

function serialize(t) {
  return {
    id: t.id,
    type: t.type,
    amount: num(t.amount),
    currency: t.currency,
    toAmount: t.toAmount === null || t.toAmount === undefined ? null : num(t.toAmount),
    note: t.note,
    date: t.date.toISOString(),
    createdAt: t.createdAt.toISOString(),
    accountId: t.accountId,
    account: t.account || null,
    toAccountId: t.toAccountId,
    toAccount: t.toAccount || null,
    categoryId: t.categoryId,
    category: t.category
      ? { id: t.category.id, name: t.category.name, icon: t.category.icon, isSystem: t.category.isSystem }
      : null,
    createdById: t.createdById,
    createdBy: t.createdBy ? { id: t.createdBy.id, name: User.fullName(t.createdBy) } : null,
    debtId: t.paymentOf ? t.paymentOf.debtId : t.principalOf ? t.principalOf.id : null,
    locked: Boolean(t.principalOf || t.paymentOf),
  };
}

function cleanNote(note) {
  const s = String(note ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 300) : null;
}

// Kiruvchi ma'lumotlarni tekshiradi va bazaga yoziladigan ko'rinishga keltiradi
async function prepare(input, db = prisma, { existingDate } = {}) {
  const type = input.type;
  if (!["INCOME", "EXPENSE", "TRANSFER"].includes(type)) throw badRequest("Operatsiya turi noto'g'ri");

  const amount = round2(input.amount);
  if (!(amount > 0)) throw badRequest("Summa noldan katta bo'lishi kerak");
  if (amount > 1e13) throw badRequest("Summa juda katta");

  const account = await db.account.findUnique({ where: { id: input.accountId } });
  if (!account) throw notFound("Hisob topilmadi");
  if (account.isArchived) throw badRequest("Bu hisob arxivlangan");

  let date;
  if (existingDate && typeof input.date === "string" && input.date === ymd(existingDate)) {
    date = existingDate;
  } else if (input.date === undefined && existingDate) {
    date = existingDate;
  } else {
    date = resolveEntryDate(input.date);
  }
  if (!date) throw badRequest("Sana noto'g'ri yoki kelajakda");

  const data = {
    type,
    amount,
    currency: account.currency,
    accountId: account.id,
    toAccountId: null,
    toAmount: null,
    categoryId: null,
    note: cleanNote(input.note),
    date,
  };

  if (type === "TRANSFER") {
    if (!input.toAccountId) throw badRequest("Qaysi hisobga o'tkazilishini tanlang");
    if (input.toAccountId === account.id) throw badRequest("Bir xil hisobga o'tkazib bo'lmaydi");
    const toAccount = await db.account.findUnique({ where: { id: input.toAccountId } });
    if (!toAccount) throw notFound("Qabul qiluvchi hisob topilmadi");
    if (toAccount.isArchived) throw badRequest("Qabul qiluvchi hisob arxivlangan");
    data.toAccountId = toAccount.id;
    if (toAccount.currency === account.currency) {
      data.toAmount = amount;
    } else {
      const toAmount = round2(input.toAmount);
      if (!(toAmount > 0)) throw badRequest("Qabul qilinadigan summani kiriting");
      data.toAmount = toAmount;
    }
  } else {
    if (!input.categoryId) throw badRequest("Toifani tanlang");
    const category = await db.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw notFound("Toifa topilmadi");
    if (category.isArchived) throw badRequest("Bu toifa arxivlangan");
    if (category.type !== type) throw badRequest("Toifa operatsiya turiga mos kelmaydi");
    data.categoryId = category.id;
  }
  return data;
}

async function getRaw(id, db = prisma) {
  return db.transaction.findUnique({ where: { id }, include: INCLUDE });
}

async function getById(id) {
  const row = await getRaw(id);
  if (!row) throw notFound("Operatsiya topilmadi");
  return serialize(row);
}

async function create(input, actor, db = prisma) {
  const data = await prepare(input, db);
  data.createdById = actor && actor.userId ? actor.userId : null;
  const row = await db.transaction.create({ data, include: INCLUDE });
  return serialize(row);
}

async function update(id, input) {
  const existing = await getRaw(id);
  if (!existing) throw notFound("Operatsiya topilmadi");
  if (existing.principalOf || existing.paymentOf) {
    throw conflict("Bu operatsiya qarz bilan bog'langan. Uni 'Qarzlar' bo'limidan o'zgartiring.", "LOCKED");
  }
  const data = await prepare(input, prisma, { existingDate: existing.date });
  const row = await prisma.transaction.update({ where: { id }, data, include: INCLUDE });
  return { before: serialize(existing), after: serialize(row) };
}

// guard(existingSerialized) - o'chirishdan oldin ruxsatni tekshirish uchun (xato tashlashi mumkin)
async function remove(id, guard) {
  const existing = await getRaw(id);
  if (!existing) throw notFound("Operatsiya topilmadi");
  if (existing.principalOf || existing.paymentOf) {
    throw conflict("Bu operatsiya qarz bilan bog'langan. Uni 'Qarzlar' bo'limidan o'chiring.", "LOCKED");
  }
  const snapshot = serialize(existing);
  if (guard) await guard(snapshot);
  await prisma.transaction.delete({ where: { id } });
  return snapshot;
}

function buildWhere(f = {}) {
  const and = [];
  if (f.type) and.push({ type: f.type });
  if (f.accountId) and.push({ OR: [{ accountId: f.accountId }, { toAccountId: f.accountId }] });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.userId) and.push({ createdById: f.userId });
  if (f.from || f.to) {
    and.push({ date: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } });
  }
  if (f.q && String(f.q).trim()) {
    const q = String(f.q).trim();
    const or = [
      { note: { contains: q, mode: "insensitive" } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { account: { name: { contains: q, mode: "insensitive" } } },
    ];
    const asNumber = Number(q.replace(/\s+/g, "").replace(",", "."));
    if (Number.isFinite(asNumber) && asNumber > 0) or.push({ amount: asNumber });
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

async function list(filters = {}, { limit = 30, offset = 0 } = {}) {
  const where = buildWhere(filters);
  const [rows, total, grouped] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["currency", "type"], where, _sum: { amount: true } }),
  ]);

  const totals = {};
  for (const g of grouped) {
    const t = (totals[g.currency] = totals[g.currency] || { income: 0, expense: 0, transfer: 0 });
    const v = num(g._sum.amount);
    if (g.type === "INCOME") t.income = v;
    else if (g.type === "EXPENSE") t.expense = v;
    else t.transfer = v;
  }

  return { items: rows.map(serialize), total, hasMore: offset + rows.length < total, totals };
}

// Excel eksporti uchun barcha mos operatsiyalar (limit bilan)
async function listAll(filters = {}, max = 20000) {
  const rows = await prisma.transaction.findMany({
    where: buildWhere(filters),
    include: INCLUDE,
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: max,
  });
  return rows.map(serialize);
}

module.exports = { INCLUDE, serialize, prepare, buildWhere, getById, create, update, remove, list, listAll };
