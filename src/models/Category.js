// Toifalar (Savdo, Ijara, Maosh ...)
const { prisma } = require("../database/connection");
const { badRequest, notFound, forbidden, conflict } = require("../utils/httpError");

// Dastur ichida ishlatiladigan tizim toifalari (o'zgartirib/o'chirib bo'lmaydi)
const SYSTEM_CATEGORIES = [
  { key: "DEBT_GIVEN", type: "EXPENSE", name: "Qarz berildi", icon: "📤", excludeFromProfit: true },
  { key: "DEBT_REPAID", type: "EXPENSE", name: "Olingan qarz qaytarildi", icon: "↩️", excludeFromProfit: true },
  { key: "CREDIT_PAID", type: "EXPENSE", name: "Nasiya to'lovi (chiqim)", icon: "🤝", excludeFromProfit: false },
  { key: "DEBT_TAKEN", type: "INCOME", name: "Qarz olindi", icon: "📥", excludeFromProfit: true },
  { key: "DEBT_COLLECTED", type: "INCOME", name: "Berilgan qarz qaytdi", icon: "↩️", excludeFromProfit: true },
  { key: "CREDIT_COLLECTED", type: "INCOME", name: "Nasiya to'lovi (kirim)", icon: "🤝", excludeFromProfit: false },
];

// Birinchi ishga tushishda qo'shiladigan oddiy toifalar
const DEFAULT_CATEGORIES = [
  { type: "INCOME", name: "Savdo tushumi", icon: "🛒" },
  { type: "INCOME", name: "Xizmat ko'rsatish", icon: "🧾" },
  { type: "INCOME", name: "Ulgurji savdo", icon: "📦" },
  { type: "INCOME", name: "Boshqa kirim", icon: "💼" },
  { type: "EXPENSE", name: "Tovar xaridi", icon: "📦" },
  { type: "EXPENSE", name: "Ijara", icon: "🏠" },
  { type: "EXPENSE", name: "Ish haqi", icon: "👥" },
  { type: "EXPENSE", name: "Soliq va yig'imlar", icon: "🧾" },
  { type: "EXPENSE", name: "Transport", icon: "🚚" },
  { type: "EXPENSE", name: "Reklama", icon: "📣" },
  { type: "EXPENSE", name: "Kommunal xizmatlar", icon: "💡" },
  { type: "EXPENSE", name: "Ta'mirlash va jihozlar", icon: "🔧" },
  { type: "EXPENSE", name: "Ovqatlanish", icon: "🍽️" },
  { type: "EXPENSE", name: "Aloqa va internet", icon: "📱" },
  { type: "EXPENSE", name: "Bank xizmati", icon: "🏦" },
  { type: "EXPENSE", name: "Boshqa chiqim", icon: "🧰" },
];

function serialize(c) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    isSystem: c.isSystem,
    excludeFromProfit: c.excludeFromProfit,
    isArchived: c.isArchived,
  };
}

async function list({ type, includeArchived = false, includeSystem = true } = {}, db = prisma) {
  const rows = await db.category.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(includeArchived ? {} : { isArchived: false }),
      ...(includeSystem ? {} : { isSystem: false }),
    },
    orderBy: [{ isSystem: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return rows;
}

async function ensureSystem() {
  for (const c of SYSTEM_CATEGORIES) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.category.findUnique({ where: { systemKey: c.key } });
    if (exists) continue;
    const data = {
      type: c.type,
      icon: c.icon,
      isSystem: true,
      systemKey: c.key,
      excludeFromProfit: c.excludeFromProfit,
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      await prisma.category.create({ data: { ...data, name: c.name } });
    } catch (err) {
      if (err.code !== "P2002") throw err;
      // eslint-disable-next-line no-await-in-loop
      await prisma.category.create({ data: { ...data, name: `${c.name} (tizim)` } });
    }
  }
}

async function ensureDefaults() {
  let order = 0;
  for (const c of DEFAULT_CATEGORIES) {
    order += 1;
    // eslint-disable-next-line no-await-in-loop
    const exists = await prisma.category.findFirst({ where: { type: c.type, name: c.name } });
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.category.create({ data: { ...c, sortOrder: order } });
    }
  }
}

async function bySystemKey(key, db = prisma) {
  const c = await db.category.findUnique({ where: { systemKey: key } });
  if (!c) throw new Error(`Tizim toifasi topilmadi: ${key}`);
  return c;
}

async function findByName(type, name, db = prisma) {
  return db.category.findFirst({ where: { type, name: { equals: name, mode: "insensitive" } } });
}

async function create({ name, type, icon }) {
  const clean = String(name || "").trim();
  if (!clean) throw badRequest("Toifa nomini kiriting");
  const existing = await findByName(type, clean);
  if (existing) {
    if (!existing.isArchived) throw conflict("Bunday nomli toifa allaqachon mavjud");
    return prisma.category.update({
      where: { id: existing.id },
      data: { isArchived: false, icon: icon || existing.icon },
    });
  }
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return prisma.category.create({
    data: { name: clean, type, icon: icon || null, sortOrder: (last._max.sortOrder || 0) + 1 },
  });
}

async function update(id, { name, icon, isArchived }) {
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) throw notFound("Toifa topilmadi");
  if (c.isSystem) throw forbidden("Tizim toifasini o'zgartirib bo'lmaydi");

  const data = {};
  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean) throw badRequest("Toifa nomini kiriting");
    const dup = await findByName(c.type, clean);
    if (dup && dup.id !== id) throw conflict("Bunday nomli toifa allaqachon mavjud");
    data.name = clean;
  }
  if (icon !== undefined) data.icon = icon || null;
  if (isArchived !== undefined) data.isArchived = Boolean(isArchived);
  return prisma.category.update({ where: { id }, data });
}

// Ishlatilgan toifa arxivlanadi, ishlatilmagan o'chiriladi
async function remove(id) {
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) throw notFound("Toifa topilmadi");
  if (c.isSystem) throw forbidden("Tizim toifasini o'chirib bo'lmaydi");
  const used = await prisma.transaction.count({ where: { categoryId: id } });
  if (used > 0) {
    await prisma.category.update({ where: { id }, data: { isArchived: true } });
    return { archived: true };
  }
  await prisma.category.delete({ where: { id } });
  return { deleted: true };
}

module.exports = {
  SYSTEM_CATEGORIES,
  serialize,
  list,
  ensureSystem,
  ensureDefaults,
  bySystemKey,
  create,
  update,
  remove,
};
