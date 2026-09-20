// Avtomatik xabarlar: kunlik hisobot, qarz eslatmalari, kurs yangilash
const cron = require("node-cron");
const config = require("../config/default");
const User = require("../models/User");
const Setting = require("../models/Setting");
const Account = require("../models/Account");
const Debt = require("../models/Debt");
const { buildReport, convertTotal } = require("./report.service");
const { refreshRates } = require("./rates.service");
const notify = require("./notify.service");
const state = require("../core/state");
const { openAppKeyboard } = require("../utils/keyboards");
const { rangeForPeriod } = require("../utils/date");
const { renderReport, renderBalances, renderDebtReminder } = require("../utils/reportText");
const { round2 } = require("../utils/money");

const tasks = [];

async function dailyReportJob() {
  if (!(await Setting.getBool("daily_report_enabled"))) return;

  const report = await buildReport(rangeForPeriod("today"));
  const active = Object.values(report.data).some((d) => d.count > 0);
  if (!active) return;

  const accounts = await Account.list({ withBalances: true });
  const balances = {};
  for (const a of accounts) balances[a.currency] = round2((balances[a.currency] || 0) + a.balance);
  const { rates } = await Setting.getRates();
  const conv = convertTotal(balances, rates);

  const text = `${renderReport(report, { title: "Kunlik hisobot" })}\n\n${renderBalances(accounts, conv)}`;
  const extra = state.webAppUrl ? { reply_markup: openAppKeyboard(state.webAppUrl) } : {};
  await notify.toManagers(text, extra, (u) => u.receiveReports);
}

async function debtReminderJob() {
  if (!(await Setting.getBool("debt_reminders_enabled"))) return;
  const debts = await Debt.dueForReminder(1);
  if (!debts.length) return;
  const extra = state.webAppUrl ? { reply_markup: openAppKeyboard(state.webAppUrl) } : {};
  await notify.toManagers(renderDebtReminder(debts), extra, (u) => u.receiveReports);
}

const safe = (name, fn) => async () => {
  try {
    await fn();
  } catch (err) {
    console.error(`[${name}] xatolik:`, err.message);
  }
};

function start() {
  const opts = { timezone: config.timezone };
  tasks.push(cron.schedule(`0 ${config.dailyReportHour} * * *`, safe("kunlik hisobot", dailyReportJob), opts));
  tasks.push(cron.schedule(`0 ${config.debtReminderHour} * * *`, safe("qarz eslatmasi", debtReminderJob), opts));
  tasks.push(cron.schedule("20 */6 * * *", safe("kurslar", () => refreshRates()), opts));

  // Ishga tushganda kurslarni ham yangilab olamiz
  safe("kurslar", () => refreshRates())();
}

function stop() {
  for (const t of tasks) {
    try {
      t.stop();
    } catch {
      // e'tiborsiz
    }
  }
}

module.exports = { start, stop, dailyReportJob, debtReminderJob };
