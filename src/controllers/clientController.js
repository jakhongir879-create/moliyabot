// Mini App (va Admin Panel) uchun umumiy API amallari.
// Har bir amal req.actor (kim so'rov yuborayotgani) asosida ruxsatni tekshiradi.
const { InputFile } = require("grammy");
const bot = require("../core/bot");
const config = require("../config/default");
const User = require("../models/User");
const Account = require("../models/Account");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Debt = require("../models/Debt");
const Setting = require("../models/Setting");
const AuditLog = require("../models/AuditLog");
const Report = require("../services/report.service");
const { buildWorkbook } = require("../services/export.service");
const notify = require("../services/notify.service");
const D = require("../utils/date");
const { esc } = require("../utils/html");
const { formatMoney } = require("../utils/money");
const { permissionsFor, isManager } = require("../utils/permissions");
const { badRequest, forbidden, HttpError } = require("../utils/httpError");

const STAFF_UNDO_MINUTES = 15;

const parseId = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest("Identifikator noto'g'ri");
  return n;
};

function safeRange(period, query = {}) {
  try {
    return D.rangeForPeriod(period, { from: query.from, to: query.to });
  } catch (err) {
    if (err instanceof RangeError) throw badRequest(err.message);
    throw err;
  }
}

const txBrief = (tx) => ({
  type: tx.type,
  amount: tx.amount,
  currency: tx.currency,
  account: tx.account ? tx.account.name : null,
  toAccount: tx.toAccount ? tx.toAccount.name : null,
  category: tx.category ? tx.category.name : null,
  note: tx.note,
  date: tx.date,
});

// ---------------------------------------------------------------
// Boshlang'ich ma'lumotlar
// ---------------------------------------------------------------

async function buildMeta(actor) {
  const perms = permissionsFor(actor.role);
  const manager = isManager(actor.role);
  const [accounts, categories, settings] = await Promise.all([
    Account.list({ withBalances: perms.viewBalances }),
    Category.list({ includeArchived: false }),
    Setting.publicSettings(),
  ]);
  return {
    permissions: perms,
    business: { name: settings.businessName },
    accounts,
    categories: categories.map(Category.serialize),
    currencies: [...new Set(accounts.map((a) => a.currency))],
    allCurrencies: Object.values(config.currencies),
    rates: { ...settings.rates, updatedAt: settings.ratesUpdatedAt },
    settings: manager ? settings : undefined,
    serverTime: new Date().toISOString(),
  };
}

async function bootstrap(req, res) {
  const meta = await buildMeta(req.actor);
  res.json({ me: req.user ? User.serialize(req.user) : null, ...meta });
}

async function dashboard(req, res) {
  const { actor } = req;
  if (isManager(actor.role)) {
    const days = (req.valid && req.valid.query && req.valid.query.days) || 7;
    const [data, recent] = await Promise.all([
      Report.managerDashboard({ days }),
      Transaction.list({}, { limit: 8 }),
    ]);
    return res.json({ ...data, recent: recent.items });
  }
  const [data, recent] = await Promise.all([
    Report.staffDashboard(actor.userId),
    Transaction.list({ userId: actor.userId }, { limit: 10 }),
  ]);
  return res.json({ staff: true, ...data, recent: recent.items });
}

// ---------------------------------------------------------------
// Operatsiyalar
// ---------------------------------------------------------------

async function listTransactions(req, res) {
  const q = req.valid.query;
  const filters = { type: q.type, accountId: q.accountId, categoryId: q.categoryId, userId: q.userId, q: q.q };
  if (req.actor.role === "STAFF") filters.userId = req.actor.userId;

  if (q.period && q.period !== "all") {
    const range = safeRange(q.period, q);
    filters.from = range.from;
    filters.to = range.to;
  } else if (!q.period) {
    if (q.from) filters.from = D.parseYMD(q.from);
    if (q.to) filters.to = D.addDays(D.parseYMD(q.to), 1);
  }

  res.json(await Transaction.list(filters, { limit: q.limit || 30, offset: q.offset || 0 }));
}

async function createTransaction(req, res) {
  const input = req.valid.body;
  if (input.type === "TRANSFER" && !permissionsFor(req.actor.role).createTransfers) {
    throw forbidden("Hisoblar orasida o'tkazma qilish uchun ruxsatingiz yo'q", "FORBIDDEN");
  }
  const tx = await Transaction.create(input, req.actor);
  await AuditLog.record(req.actor, "create", "transaction", tx.id, txBrief(tx));
  if (req.user) notify.transactionCreated({ user: req.user, tx, viaBot: false });
  res.status(201).json(tx);
}

async function updateTransaction(req, res) {
  const id = parseId(req.params.id);
  const { before, after } = await Transaction.update(id, req.valid.body);
  await AuditLog.record(req.actor, "update", "transaction", id, { before: txBrief(before), after: txBrief(after) });
  res.json(after);
}

async function deleteTransaction(req, res) {
  const id = parseId(req.params.id);
  const removed = await Transaction.remove(id, async (tx) => {
    if (isManager(req.actor.role)) return;
    const own = tx.createdById === req.actor.userId;
    const fresh = Date.now() - new Date(tx.createdAt).getTime() < STAFF_UNDO_MINUTES * 60 * 1000;
    if (!own || !fresh) {
      throw forbidden(`Xodim faqat o'zi kiritgan operatsiyani ${STAFF_UNDO_MINUTES} daqiqa ichida o'chira oladi`, "FORBIDDEN");
    }
  });
  await AuditLog.record(req.actor, "delete", "transaction", id, txBrief(removed));
  if (!isManager(req.actor.role) && req.user) {
    const what = `${removed.type === "INCOME" ? "kirim" : "chiqim"}: ${formatMoney(removed.amount, removed.currency)}`;
    notify.toOwners(`🗑 <b>${esc(req.actor.name)}</b> o'zi kiritgan operatsiyani o'chirdi (${esc(what)})`, {
      disable_notification: true,
    });
  }
  res.json({ ok: true });
}

// ---------------------------------------------------------------
// Hisoblar
// ---------------------------------------------------------------

async function listAccounts(req, res) {
  const perms = permissionsFor(req.actor.role);
  const includeArchived = perms.manageAccounts && req.query.all === "1";
  res.json({ items: await Account.list({ includeArchived, withBalances: perms.viewBalances }) });
}

async function createAccount(req, res) {
  const account = await Account.create(req.valid.body);
  await AuditLog.record(req.actor, "create", "account", account.id, { name: account.name, currency: account.currency });
  res.status(201).json(account);
}

async function updateAccount(req, res) {
  const id = parseId(req.params.id);
  const account = await Account.update(id, req.valid.body);
  await AuditLog.record(req.actor, "update", "account", id, req.valid.body);
  res.json(account);
}

async function deleteAccount(req, res) {
  const id = parseId(req.params.id);
  const result = await Account.remove(id);
  await AuditLog.record(req.actor, result.archived ? "archive" : "delete", "account", id);
  res.json({ ok: true, ...result });
}

// ---------------------------------------------------------------
// Toifalar
// ---------------------------------------------------------------

async function listCategories(req, res) {
  const includeArchived = permissionsFor(req.actor.role).manageCategories && req.query.all === "1";
  const rows = await Category.list({ includeArchived });
  res.json({ items: rows.map(Category.serialize) });
}

async function createCategory(req, res) {
  const c = await Category.create(req.valid.body);
  await AuditLog.record(req.actor, "create", "category", c.id, { name: c.name, type: c.type });
  res.status(201).json(Category.serialize(c));
}

async function updateCategory(req, res) {
  const id = parseId(req.params.id);
  const c = await Category.update(id, req.valid.body);
  await AuditLog.record(req.actor, "update", "category", id, req.valid.body);
  res.json(Category.serialize(c));
}

async function deleteCategory(req, res) {
  const id = parseId(req.params.id);
  const result = await Category.remove(id);
  await AuditLog.record(req.actor, result.archived ? "archive" : "delete", "category", id);
  res.json({ ok: true, ...result });
}

// ---------------------------------------------------------------
// Qarzlar
// ---------------------------------------------------------------

async function listDebts(req, res) {
  const { type, status, q } = req.valid.query;
  res.json({ items: await Debt.list({ type, status: status || "OPEN", q }), summary: await Debt.summary() });
}

async function getDebt(req, res) {
  res.json(await Debt.getById(parseId(req.params.id)));
}

async function createDebt(req, res) {
  const debt = await Debt.create(req.valid.body, req.actor);
  await AuditLog.record(req.actor, "create", "debt", debt.id, {
    type: debt.type,
    person: debt.personName,
    amount: debt.amount,
    currency: debt.currency,
  });
  res.status(201).json(debt);
}

async function updateDebt(req, res) {
  const id = parseId(req.params.id);
  const { before, after } = await Debt.update(id, req.valid.body);
  await AuditLog.record(req.actor, "update", "debt", id, {
    before: { person: before.personName, amount: before.amount, dueDate: before.dueDate },
    after: { person: after.personName, amount: after.amount, dueDate: after.dueDate },
  });
  res.json(after);
}

async function deleteDebt(req, res) {
  const id = parseId(req.params.id);
  const removed = await Debt.remove(id);
  await AuditLog.record(req.actor, "delete", "debt", id, {
    type: removed.type,
    person: removed.personName,
    amount: removed.amount,
    currency: removed.currency,
  });
  res.json({ ok: true });
}

async function addDebtPayment(req, res) {
  const id = parseId(req.params.id);
  const debt = await Debt.addPayment(id, req.valid.body, req.actor);
  await AuditLog.record(req.actor, "payment", "debt", id, {
    person: debt.personName,
    amount: req.valid.body.amount,
    currency: debt.currency,
  });
  res.status(201).json(debt);
}

async function removeDebtPayment(req, res) {
  const debtId = parseId(req.params.id);
  const paymentId = parseId(req.params.paymentId);
  const debt = await Debt.removePayment(debtId, paymentId);
  await AuditLog.record(req.actor, "delete-payment", "debt", debtId, { person: debt.personName });
  res.json(debt);
}

// ---------------------------------------------------------------
// Hisobotlar va eksport
// ---------------------------------------------------------------

async function report(req, res) {
  const { period, from, to } = req.valid.query;
  res.json(await Report.buildReport(safeRange(period, { from, to })));
}

async function exportToChat(req, res) {
  if (!req.user) throw badRequest("Bu amal faqat Telegram ichida ishlaydi");
  const { period, from, to } = req.valid.body;
  const range = safeRange(period, { from, to });
  const settings = await Setting.publicSettings();
  const { buffer, filename, count } = await buildWorkbook({ range, businessName: settings.businessName });

  try {
    await bot.api.sendDocument(Number(req.user.telegramId), new InputFile(buffer, filename), {
      caption: `📊 ${range.label} — ${count} ta operatsiya`,
    });
  } catch (err) {
    throw new HttpError(502, "Faylni Telegram'ga yuborib bo'lmadi. Botga /start yuborganingizni tekshiring.", "SEND_FAILED");
  }
  res.json({ ok: true, filename, count });
}

// ---------------------------------------------------------------
// Foydalanuvchilar
// ---------------------------------------------------------------

async function listUsers(_req, res) {
  const rows = await User.list();
  res.json({ items: rows.map(User.serialize) });
}

async function updateUser(req, res) {
  const id = parseId(req.params.id);
  const target = await User.findById(id);
  if (!target) throw new HttpError(404, "Foydalanuvchi topilmadi", "NOT_FOUND");
  if (target.role === "OWNER") throw forbidden("Egasining ruxsatlarini o'zgartirib bo'lmaydi", "FORBIDDEN");

  const { role, status } = req.valid.body;
  const data = {};
  if (role) data.role = role;
  if (status) data.status = status;
  if (!Object.keys(data).length) throw badRequest("O'zgartirish uchun ma'lumot yuborilmadi");

  const updated = await User.update(id, data);
  await AuditLog.record(req.actor, "update", "user", id, { name: User.fullName(updated), ...data });

  if (target.status !== "ACTIVE" && updated.status === "ACTIVE") notify.userApproved(updated);
  res.json(User.serialize(updated));
}

// ---------------------------------------------------------------
// Profil
// ---------------------------------------------------------------

async function updateMe(req, res) {
  if (!req.user) throw badRequest("Bu amal faqat Telegram ichida ishlaydi");
  const { sendReceipts, receiveReports } = req.valid.body;
  const data = {};
  if (sendReceipts !== undefined) data.sendReceipts = sendReceipts;
  if (receiveReports !== undefined) data.receiveReports = receiveReports;
  const updated = Object.keys(data).length ? await User.update(req.user.id, data) : req.user;
  res.json(User.serialize(updated));
}

async function markOnboarded(req, res) {
  if (!req.user) return res.json({ ok: true });
  const updated = await User.update(req.user.id, { onboarded: true });
  return res.json(User.serialize(updated));
}

module.exports = {
  buildMeta,
  bootstrap,
  dashboard,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listDebts,
  getDebt,
  createDebt,
  updateDebt,
  deleteDebt,
  addDebtPayment,
  removeDebtPayment,
  report,
  exportToChat,
  listUsers,
  updateUser,
  updateMe,
  markOnboarded,
};
