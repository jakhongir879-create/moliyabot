// Foydalanuvchilar bilan ishlash (Prisma logikasi)
const { prisma } = require("../database/connection");
const config = require("../config/default");
const { ROLE_LABELS } = require("../utils/permissions");

const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.username || `ID ${u.telegramId}`;

function serialize(u) {
  return {
    id: u.id,
    telegramId: Number(u.telegramId),
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    fullName: fullName(u),
    phone: u.phone,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    status: u.status,
    onboarded: u.onboarded,
    sendReceipts: u.sendReceipts,
    receiveReports: u.receiveReports,
    createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
  };
}

const findByTelegramId = (telegramId) => prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
const findById = (id) => prisma.user.findUnique({ where: { id } });

// Telegram profilida ism o'zgargan bo'lsa, bazadagi nusxani yangilaydi
async function syncProfile(user, from) {
  const data = {};
  if (from.first_name && from.first_name !== user.firstName) data.firstName = from.first_name;
  if ((from.last_name || null) !== user.lastName) data.lastName = from.last_name || null;
  if ((from.username || null) !== user.username) data.username = from.username || null;
  if (!Object.keys(data).length) return user;
  return prisma.user.update({ where: { id: user.id }, data });
}

function create(from, { role = "STAFF", status = "PENDING" } = {}) {
  return prisma.user.create({
    data: {
      telegramId: BigInt(from.id),
      firstName: from.first_name || "Foydalanuvchi",
      lastName: from.last_name || null,
      username: from.username || null,
      role,
      status,
    },
  });
}

async function hasOwner() {
  return (await prisma.user.count({ where: { role: "OWNER", status: "ACTIVE" } })) > 0;
}

// Egasini yaratadi yoki mavjud foydalanuvchini egasi qiladi
async function makeOwner(from) {
  const existing = await findByTelegramId(from.id);
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { role: "OWNER", status: "ACTIVE", firstName: from.first_name || existing.firstName },
    });
  }
  return create(from, { role: "OWNER", status: "ACTIVE" });
}

// .env dagi OWNER_TELEGRAM_ID bo'yicha egasini tayyorlaydi
async function ensureOwnerFromEnv() {
  if (!/^\d{3,15}$/.test(config.ownerTelegramId)) return null;
  const telegramId = BigInt(config.ownerTelegramId);
  return prisma.user.upsert({
    where: { telegramId },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { telegramId, firstName: "Egasi", role: "OWNER", status: "ACTIVE" },
  });
}

const owners = () =>
  prisma.user.findMany({ where: { role: "OWNER", status: "ACTIVE" }, orderBy: { id: "asc" } });

const managers = () =>
  prisma.user.findMany({
    where: { role: { in: ["OWNER", "ACCOUNTANT"] }, status: "ACTIVE" },
    orderBy: { id: "asc" },
  });

async function list() {
  const rows = await prisma.user.findMany({ orderBy: [{ createdAt: "asc" }] });
  const order = { PENDING: 0, ACTIVE: 1, BLOCKED: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.id - b.id);
}

const update = (id, data) => prisma.user.update({ where: { id }, data });

// Oxirgi faollik vaqtini (har 5 daqiqada bir marta) yangilaydi
async function touch(user) {
  const stale = !user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 5 * 60 * 1000;
  if (!stale) return user;
  return prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
}

module.exports = {
  fullName,
  serialize,
  findByTelegramId,
  findById,
  syncProfile,
  create,
  hasOwner,
  makeOwner,
  ensureOwnerFromEnv,
  owners,
  managers,
  list,
  update,
  touch,
};
