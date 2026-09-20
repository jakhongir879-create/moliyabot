// Hisoblar: naqd pul, plastik karta, bank hisob raqami
const { prisma } = require("../database/connection");
const config = require("../config/default");
const { badRequest, notFound, conflict } = require("../utils/httpError");
const { round2, num, formatMoney } = require("../utils/money");

const TYPE_ICONS = { CASH: "💵", CARD: "💳", BANK: "🏦", OTHER: "👛" };

const DEFAULT_ACCOUNTS = [
  { name: "Naqd pul", type: "CASH", currency: "UZS", icon: "💵" },
  { name: "Plastik karta", type: "CARD", currency: "UZS", icon: "💳" },
];

function serialize(a, balance) {
  const out = {
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    icon: a.icon || TYPE_ICONS[a.type],
    initialBalance: num(a.initialBalance),
    isArchived: a.isArchived,
  };
  if (balance !== undefined) out.balance = round2(balance);
  return out;
}

// Har bir hisob uchun tranzaksiyalardan kelib chiqadigan o'zgarish
async function deltaMap(db = prisma) {
  const [sums, incoming] = await Promise.all([
    db.transaction.groupBy({ by: ["accountId", "type"], _sum: { amount: true } }),
    db.transaction.groupBy({
      by: ["toAccountId"],
      where: { type: "TRANSFER", toAccountId: { not: null } },
      _sum: { toAmount: true },
    }),
  ]);
  const map = new Map();
  const add = (id, v) => map.set(id, (map.get(id) || 0) + v);
  for (const r of sums) {
    const v = Number(r._sum.amount || 0);
    add(r.accountId, r.type === "INCOME" ? v : -v);
  }
  for (const r of incoming) add(r.toAccountId, Number(r._sum.toAmount || 0));
  return map;
}

async function list({ includeArchived = false, withBalances = false } = {}, db = prisma) {
  const rows = await db.account.findMany({
    where: includeArchived ? {} : { isArchived: false },
    orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  if (!withBalances) return rows.map((a) => serialize(a));
  const deltas = await deltaMap(db);
  return rows.map((a) => serialize(a, Number(a.initialBalance) + (deltas.get(a.id) || 0)));
}

async function balanceOf(id, db = prisma) {
  const a = await db.account.findUnique({ where: { id } });
  if (!a) throw notFound("Hisob topilmadi");
  const deltas = await deltaMap(db);
  return round2(Number(a.initialBalance) + (deltas.get(id) || 0));
}

function checkCurrency(currency) {
  if (!config.currencies[currency]) throw badRequest("Valyuta qo'llab-quvvatlanmaydi");
}

async function create({ name, type = "CASH", currency = "UZS", initialBalance = 0, icon }) {
  const clean = String(name || "").trim();
  if (!clean) throw badRequest("Hisob nomini kiriting");
  checkCurrency(currency);
  const dup = await prisma.account.findFirst({
    where: { name: { equals: clean, mode: "insensitive" }, currency, isArchived: false },
  });
  if (dup) throw conflict("Bu valyutada bunday nomli hisob allaqachon mavjud");
  const last = await prisma.account.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.account.create({
    data: {
      name: clean,
      type,
      currency,
      initialBalance: round2(initialBalance),
      icon: icon || null,
      sortOrder: (last._max.sortOrder || 0) + 1,
    },
  });
  return serialize(row, Number(row.initialBalance));
}

async function update(id, patch) {
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a) throw notFound("Hisob topilmadi");
  const data = {};

  if (patch.name !== undefined) {
    const clean = String(patch.name).trim();
    if (!clean) throw badRequest("Hisob nomini kiriting");
    const dup = await prisma.account.findFirst({
      where: { name: { equals: clean, mode: "insensitive" }, currency: a.currency, isArchived: false, NOT: { id } },
    });
    if (dup) throw conflict("Bu valyutada bunday nomli hisob allaqachon mavjud");
    data.name = clean;
  }
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.icon !== undefined) data.icon = patch.icon || null;
  if (patch.initialBalance !== undefined) data.initialBalance = round2(patch.initialBalance);

  if (patch.isArchived === true && !a.isArchived) {
    const balance = await balanceOf(id);
    if (Math.abs(balance) >= 0.005) {
      throw conflict(
        `Hisobda ${formatMoney(balance, a.currency)} qoldiq bor. Avval uni boshqa hisobga o'tkazing, so'ng arxivlang.`
      );
    }
    data.isArchived = true;
  } else if (patch.isArchived === false) {
    data.isArchived = false;
  }

  const row = await prisma.account.update({ where: { id }, data });
  return serialize(row, await balanceOf(id));
}

// Operatsiyasi bo'lmasa o'chiriladi, bo'lsa arxivlanadi
async function remove(id) {
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a) throw notFound("Hisob topilmadi");
  const used = await prisma.transaction.count({ where: { OR: [{ accountId: id }, { toAccountId: id }] } });
  if (used === 0) {
    await prisma.account.delete({ where: { id } });
    return { deleted: true };
  }
  await update(id, { isArchived: true });
  return { archived: true };
}

async function ensureDefaults() {
  let order = 0;
  for (const a of DEFAULT_ACCOUNTS) {
    order += 1;
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.account.findFirst({ where: { name: a.name, currency: a.currency } });
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.account.create({ data: { ...a, sortOrder: order } });
    }
  }
}

module.exports = { TYPE_ICONS, serialize, deltaMap, list, balanceOf, create, update, remove, ensureDefaults };
