// Hisobotlar, boshqaruv paneli ko'rsatkichlari va "insight" kartalari
const { prisma } = require("../database/connection");
const Setting = require("../models/Setting");
const Account = require("../models/Account");
const Debt = require("../models/Debt");
const D = require("../utils/date");
const { round2, formatMoney } = require("../utils/money");

const round1 = (n) => Math.round(n * 10) / 10;

async function fetchRows(from, to, extraWhere = {}) {
  return prisma.transaction.findMany({
    where: { date: { gte: from, lt: to }, type: { in: ["INCOME", "EXPENSE"] }, ...extraWhere },
    select: {
      type: true,
      amount: true,
      currency: true,
      date: true,
      category: { select: { id: true, name: true, icon: true, excludeFromProfit: true } },
    },
  });
}

const emptyAgg = () => ({
  income: 0,
  expense: 0,
  excludedIncome: 0,
  excludedExpense: 0,
  count: 0,
  cats: { INCOME: new Map(), EXPENSE: new Map() },
  series: new Map(),
});

// Qatorlarni valyuta bo'yicha yig'adi. "Foydaga kirmaydigan" toifalar (qarz asosiy summasi) alohida hisoblanadi.
function reduceRows(rows, granularity) {
  const out = {};
  for (const r of rows) {
    const agg = (out[r.currency] = out[r.currency] || emptyAgg());
    const amount = Number(r.amount);
    agg.count += 1;

    if (r.category && r.category.excludeFromProfit) {
      if (r.type === "INCOME") agg.excludedIncome += amount;
      else agg.excludedExpense += amount;
      continue;
    }

    const isIncome = r.type === "INCOME";
    if (isIncome) agg.income += amount;
    else agg.expense += amount;

    const catId = r.category ? r.category.id : 0;
    const map = agg.cats[r.type];
    const entry = map.get(catId) || {
      id: catId,
      name: r.category ? r.category.name : "Toifasiz",
      icon: r.category ? r.category.icon : null,
      total: 0,
      count: 0,
    };
    entry.total += amount;
    entry.count += 1;
    map.set(catId, entry);

    const key = D.bucketKey(r.date, granularity);
    const bucket = agg.series.get(key) || { income: 0, expense: 0 };
    if (isIncome) bucket.income += amount;
    else bucket.expense += amount;
    agg.series.set(key, bucket);
  }
  return out;
}

function pctChange(current, previous) {
  if (!previous) return current ? null : 0;
  return round1(((current - previous) / previous) * 100);
}

function categoryList(map, total) {
  return [...map.values()]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      total: round2(c.total),
      count: c.count,
      percent: total > 0 ? round1((c.total / total) * 100) : 0,
    }));
}

async function accountCurrencies() {
  const rows = await prisma.account.findMany({
    where: { isArchived: false },
    select: { currency: true },
    distinct: ["currency"],
  });
  return rows.map((r) => r.currency);
}

// Berilgan davr uchun to'liq hisobot (valyutalar bo'yicha alohida)
async function buildReport(range, { now = new Date() } = {}) {
  const [rows, prevRows, accCurrencies] = await Promise.all([
    fetchRows(range.from, range.to),
    fetchRows(range.prevFrom, range.prevTo),
    accountCurrencies(),
  ]);

  const current = reduceRows(rows, range.granularity);
  const previous = reduceRows(prevRows, range.granularity);
  const codes = [...new Set([...accCurrencies, ...Object.keys(current), ...Object.keys(previous)])].sort((a, b) =>
    a === "UZS" ? -1 : b === "UZS" ? 1 : a.localeCompare(b)
  );
  const keys = D.buildBuckets(range, now);

  const data = {};
  for (const code of codes) {
    const c = current[code] || emptyAgg();
    const p = previous[code] || emptyAgg();
    const profit = round2(c.income - c.expense);
    const prevProfit = round2(p.income - p.expense);
    data[code] = {
      income: round2(c.income),
      expense: round2(c.expense),
      profit,
      count: c.count,
      prev: { income: round2(p.income), expense: round2(p.expense), profit: prevProfit },
      change: {
        income: pctChange(c.income, p.income),
        expense: pctChange(c.expense, p.expense),
        profit: pctChange(profit, prevProfit),
      },
      excluded: { income: round2(c.excludedIncome), expense: round2(c.excludedExpense) },
      byCategory: {
        income: categoryList(c.cats.INCOME, c.income),
        expense: categoryList(c.cats.EXPENSE, c.expense),
      },
      series: keys.map((k) => {
        const b = c.series.get(k);
        return {
          key: k,
          label: D.bucketLabel(k, range.granularity),
          income: round2(b ? b.income : 0),
          expense: round2(b ? b.expense : 0),
        };
      }),
    };
  }

  return {
    range: {
      period: range.period,
      label: range.label,
      compareLabel: range.compareLabel,
      granularity: range.granularity,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      fromYmd: D.ymd(range.from),
      toYmd: D.ymd(D.addDays(range.to, -1)),
    },
    currencies: codes,
    data,
  };
}

// Hisoblardagi qoldiqlarni umumiy so'mga o'giradi
function convertTotal(balancesByCurrency, rates) {
  let total = 0;
  const missing = [];
  for (const [code, value] of Object.entries(balancesByCurrency)) {
    if (!value) continue;
    const rate = rates[code];
    if (!rate) {
      missing.push(code);
      continue;
    }
    total += value * rate;
  }
  // Kurs bo'yicha o'girilgan summa taxminiy, shuning uchun butun so'mgacha yaxlitlanadi
  return { totalUZS: Math.round(total), missingRates: missing };
}

function sumBetween(rows, from, to) {
  const out = {};
  for (const r of rows) {
    if (r.date < from || r.date >= to) continue;
    if (r.category && r.category.excludeFromProfit) continue;
    const o = (out[r.currency] = out[r.currency] || { income: 0, expense: 0 });
    if (r.type === "INCOME") o.income += Number(r.amount);
    else o.expense += Number(r.amount);
  }
  for (const o of Object.values(out)) {
    o.income = round2(o.income);
    o.expense = round2(o.expense);
    o.profit = round2(o.income - o.expense);
  }
  return out;
}

const zero = () => ({ income: 0, expense: 0, profit: 0 });
const pctText = (p) => (p === null ? "yangi" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)}%`);

function buildInsights({ primary, today, week, previousWeek, monthTop, debts, rates }) {
  const list = [];
  const t = today[primary] || zero();
  const w = week[primary] || zero();
  const pw = previousWeek[primary] || zero();

  list.push({
    id: "today",
    icon: "☀️",
    title: "Bugun",
    tone: t.profit >= 0 ? "positive" : "negative",
    headline: formatMoney(t.profit, primary, { sign: true }),
    sub: "Bugungi sof foyda",
    rows: [
      { label: "Kirim", value: formatMoney(t.income, primary), tone: "income" },
      { label: "Chiqim", value: formatMoney(t.expense, primary), tone: "expense" },
    ],
  });

  list.push({
    id: "week",
    icon: "📅",
    title: "Hafta",
    tone: w.profit >= 0 ? "positive" : "negative",
    headline: formatMoney(w.profit, primary, { sign: true }),
    sub: "Shu haftadagi sof foyda",
    rows: [
      { label: "Kirim", value: formatMoney(w.income, primary), tone: "income" },
      { label: "Chiqim", value: formatMoney(w.expense, primary), tone: "expense" },
      { label: "Chiqim o'zgarishi", value: `${pctText(pctChange(w.expense, pw.expense))} (o'tgan haftaga nisbatan)` },
    ],
  });

  const receivable = debts.totals.RECEIVABLE[primary] || 0;
  const payable = debts.totals.PAYABLE[primary] || 0;
  if (receivable || payable || debts.overdue) {
    list.push({
      id: "debts",
      icon: "🤝",
      title: "Qarzlar",
      tone: debts.overdue ? "warning" : "neutral",
      headline: formatMoney(receivable, primary),
      sub: "Sizga qarzdor",
      rows: [
        { label: "Siz qarzdorsiz", value: formatMoney(payable, primary), tone: "expense" },
        { label: "Muddati o'tgan", value: `${debts.overdue} ta`, tone: debts.overdue ? "expense" : undefined },
      ],
    });
  }

  if (monthTop.length) {
    list.push({
      id: "top",
      icon: "🏆",
      title: "Eng katta chiqim",
      tone: "neutral",
      headline: `${monthTop[0].icon || ""} ${monthTop[0].name}`.trim(),
      sub: `Shu oyda ${formatMoney(monthTop[0].total, primary)} (${monthTop[0].percent}%)`,
      rows: monthTop.slice(1, 4).map((c) => ({
        label: `${c.icon || ""} ${c.name}`.trim(),
        value: formatMoney(c.total, primary),
      })),
    });
  }

  const rateRows = ["USD", "EUR", "RUB"]
    .filter((c) => rates[c])
    .map((c) => ({ label: `1 ${c}`, value: formatMoney(rates[c], "UZS") }));
  if (rateRows.length) {
    list.push({
      id: "rates",
      icon: "💱",
      title: "Kurs",
      tone: "neutral",
      headline: rates.USD ? formatMoney(rates.USD, "UZS") : rateRows[0].value,
      sub: rates.USD ? "1 AQSH dollari (MB kursi)" : rateRows[0].label,
      rows: rateRows,
    });
  }

  return list;
}

// Egasi/buxgalter uchun bosh sahifa ma'lumotlari
async function managerDashboard({ days = 7, now = new Date() } = {}) {
  const today = D.startOfDay(now);
  const tomorrow = D.addDays(today, 1);
  const weekStart = D.startOfWeek(now);
  const prevWeekStart = D.addDays(weekStart, -7);
  const monthStart = D.startOfMonth(now);
  const prevMonthStart = D.startOfMonth(now, -1);
  const seriesStart = D.addDays(today, -(days - 1));
  const fetchFrom = new Date(Math.min(prevMonthStart.getTime(), prevWeekStart.getTime(), seriesStart.getTime()));

  const [accounts, rows, debts, ratesInfo] = await Promise.all([
    Account.list({ withBalances: true }),
    fetchRows(fetchFrom, tomorrow),
    Debt.summary(),
    Setting.getRates(),
  ]);

  const balances = {};
  for (const a of accounts) balances[a.currency] = round2((balances[a.currency] || 0) + a.balance);
  const { totalUZS, missingRates } = convertTotal(balances, ratesInfo.rates);
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const primary = currencies.includes("UZS") ? "UZS" : currencies[0] || "UZS";

  const todaySums = sumBetween(rows, today, tomorrow);
  const yesterdaySums = sumBetween(rows, D.addDays(today, -1), today);
  const weekSums = sumBetween(rows, weekStart, tomorrow);
  const prevWeekSums = sumBetween(rows, prevWeekStart, weekStart);
  const monthSums = sumBetween(rows, monthStart, tomorrow);
  const prevMonthSums = sumBetween(rows, prevMonthStart, monthStart);

  // Oxirgi N kunlik diagramma
  const seriesRows = rows.filter((r) => r.date >= seriesStart);
  const seriesRange = { from: seriesStart, to: tomorrow, granularity: "day" };
  const keys = D.buildBuckets(seriesRange, now);
  const reduced = reduceRows(seriesRows, "day");
  const series = {};
  for (const code of currencies) {
    const agg = reduced[code] || emptyAgg();
    series[code] = keys.map((k) => {
      const b = agg.series.get(k);
      return {
        key: k,
        label: D.bucketLabel(k, "day"),
        income: round2(b ? b.income : 0),
        expense: round2(b ? b.expense : 0),
      };
    });
  }

  // Shu oy eng katta chiqimlar
  const monthReduced = reduceRows(
    rows.filter((r) => r.date >= monthStart),
    "day"
  );
  const topExpenses = {};
  for (const code of currencies) {
    const agg = monthReduced[code];
    topExpenses[code] = agg ? categoryList(agg.cats.EXPENSE, agg.expense).slice(0, 5) : [];
  }

  const insights = buildInsights({
    primary,
    today: todaySums,
    week: weekSums,
    previousWeek: prevWeekSums,
    monthTop: topExpenses[primary] || [],
    debts,
    rates: ratesInfo.rates,
  });

  return {
    primaryCurrency: primary,
    currencies,
    balances: { byCurrency: balances, totalUZS, missingRates },
    accounts,
    today: todaySums,
    yesterday: yesterdaySums,
    week: { current: weekSums, previous: prevWeekSums },
    month: { current: monthSums, previous: prevMonthSums },
    series,
    topExpenses,
    debts,
    rates: { ...ratesInfo.rates, updatedAt: ratesInfo.updatedAt },
    insights,
    dateLabel: `${D.weekdayName(now)}, ${D.formatDate(now)}`,
  };
}

// Xodim uchun: faqat o'zi bugun kiritganlar
async function staffDashboard(userId, now = new Date()) {
  const today = D.startOfDay(now);
  const rows = await fetchRows(today, D.addDays(today, 1), { createdById: userId });
  return {
    today: sumBetween(rows, today, D.addDays(today, 1)),
    count: rows.length,
    dateLabel: `${D.weekdayName(now)}, ${D.formatDate(now)}`,
  };
}

module.exports = { fetchRows, buildReport, managerDashboard, staffDashboard, convertTotal, pctText };
