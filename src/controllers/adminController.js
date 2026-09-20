// Admin Panel uchun API (kirish, tizim holati, sozlamalar, jurnal, Excel yuklab olish)
// Operatsiyalar, hisoblar, toifalar, qarzlar va foydalanuvchilar bilan ishlash clientController ichida
// bo'lib, admin.routes.js orqali shu yerdagi kirish tekshiruvi bilan ulanadi.
const pkg = require("../../package.json");
const config = require("../config/default");
const state = require("../core/state");
const { prisma } = require("../database/connection");
const User = require("../models/User");
const Setting = require("../models/Setting");
const AuditLog = require("../models/AuditLog");
const { buildWorkbook } = require("../services/export.service");
const { refreshRates, setManualRates } = require("../services/rates.service");
const { passwordMatches, signAdminToken } = require("../middlewares/auth.middleware");
const { buildMeta } = require("./clientController");
const D = require("../utils/date");
const { HttpError, badRequest } = require("../utils/httpError");

async function login(req, res) {
  const { password } = req.valid.body;
  if (!config.adminPassword) {
    throw new HttpError(503, "ADMIN_PASSWORD .env faylida o'rnatilmagan.", "NO_ADMIN_PASSWORD");
  }
  if (!passwordMatches(password)) throw new HttpError(401, "Parol noto'g'ri", "BAD_PASSWORD");
  res.json({ token: signAdminToken(), expiresIn: config.jwtExpiresIn });
}

// Token yaroqliligini tekshirish uchun (adminAuth allaqachon o'tgan bo'ladi)
function me(_req, res) {
  res.json({ ok: true, name: "Admin" });
}

async function meta(req, res) {
  const data = await buildMeta(req.actor);
  const pending = await prisma.user.count({ where: { status: "PENDING" } });
  res.json({ ...data, pendingUsers: pending });
}

async function system(_req, res) {
  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }
  const [hasOwner, users, pending, transactions] = await Promise.all([
    User.hasOwner(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "PENDING" } }),
    prisma.transaction.count(),
  ]);
  res.json({
    version: pkg.version,
    uptimeSeconds: Math.round(process.uptime()),
    database: { ok: databaseOk },
    bot: { online: state.botOnline, username: state.botUsername, name: state.botName, error: state.botError },
    webApp: {
      url: state.webAppUrl,
      source: state.webAppSource,
      menuButtonSet: state.menuButtonSet,
      tunnel: { provider: state.tunnelProvider, status: state.tunnelStatus },
    },
    owner: { exists: hasOwner, setupCode: hasOwner ? null : config.ownerSetupCode },
    counts: { users, pendingUsers: pending, transactions },
    schedule: { dailyReportHour: config.dailyReportHour, debtReminderHour: config.debtReminderHour },
    timezone: config.timezone,
  });
}

async function getSettings(_req, res) {
  res.json(await Setting.publicSettings());
}

async function updateSettings(req, res) {
  const b = req.valid.body;
  const values = {};
  if (b.businessName !== undefined) values.business_name = b.businessName;
  if (b.notifyOwnerOnStaffEntry !== undefined) values.notify_owner_staff_entry = b.notifyOwnerOnStaffEntry;
  if (b.dailyReportEnabled !== undefined) values.daily_report_enabled = b.dailyReportEnabled;
  if (b.debtRemindersEnabled !== undefined) values.debt_reminders_enabled = b.debtRemindersEnabled;
  if (Object.keys(values).length) await Setting.setMany(values);

  let warning = null;
  if (b.rateAuto === true) {
    await Setting.set("rate_auto", true);
    try {
      await refreshRates({ force: true });
    } catch (err) {
      warning = "Kurslarni Markaziy bankdan olib bo'lmadi. Internetni tekshirib, keyinroq urinib ko'ring.";
    }
  } else if (b.rateAuto === false) {
    if (b.rates && Object.values(b.rates).some(Boolean)) await setManualRates(b.rates);
    else await Setting.set("rate_auto", false);
  } else if (b.rates && Object.values(b.rates).some(Boolean)) {
    await setManualRates(b.rates);
  }

  await AuditLog.record(req.actor, "update", "settings", null, b);
  res.json({ ...(await Setting.publicSettings()), warning });
}

async function auditLog(req, res) {
  const { limit, offset } = req.valid.query;
  res.json(await AuditLog.list({ limit: limit || 50, offset: offset || 0 }));
}

// Brauzerda Excel faylini yuklab olish
async function downloadExport(req, res) {
  const q = req.valid.query;
  const period = q.period && q.period !== "all" ? q.period : q.from || q.to ? "custom" : "month";
  let range;
  if (q.period === "all") {
    const first = await prisma.transaction.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
    const start = first ? D.startOfDay(first.date) : D.startOfMonth();
    const end = D.addDays(D.startOfDay(new Date()), 1);
    range = { period: "all", from: start, to: end, label: "Barcha vaqt", granularity: "month" };
  } else {
    try {
      range = D.rangeForPeriod(period, { from: q.from, to: q.to });
    } catch (err) {
      throw badRequest(err.message);
    }
  }

  const filters = { type: q.type, accountId: q.accountId, categoryId: q.categoryId, userId: q.userId, q: q.q };
  const settings = await Setting.publicSettings();
  const { buffer, filename } = await buildWorkbook({ range, filters, businessName: settings.businessName });

  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
  });
  res.send(buffer);
}

module.exports = { login, me, meta, system, getSettings, updateSettings, auditLog, downloadExport };
