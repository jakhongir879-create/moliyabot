// Sozlamalar (kalit-qiymat) va valyuta kurslari
const { prisma } = require("../database/connection");
const config = require("../config/default");

const DEFAULTS = {
  business_name: config.businessName,
  notify_owner_staff_entry: "true",
  daily_report_enabled: "true",
  debt_reminders_enabled: "true",
  rate_auto: "true",
  rates: "{}",
  rates_updated_at: "",
};

let cache = null;
let cacheAt = 0;
const CACHE_MS = 5000;

async function all() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const rows = await prisma.setting.findMany();
  cache = { ...DEFAULTS };
  for (const row of rows) cache[row.key] = row.value;
  cacheAt = Date.now();
  return cache;
}

async function get(key) {
  return (await all())[key];
}

async function getBool(key) {
  return (await get(key)) === "true";
}

async function set(key, value) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    update: { value: str },
    create: { key, value: str },
  });
  cache = null;
}

async function setMany(values) {
  for (const [key, value] of Object.entries(values)) {
    // eslint-disable-next-line no-await-in-loop
    await set(key, typeof value === "boolean" ? String(value) : value);
  }
}

// Boshlang'ich sozlamalarni bir marta yozib qo'yadi
async function ensureDefaults() {
  const existing = new Set((await prisma.setting.findMany({ select: { key: true } })).map((r) => r.key));
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!existing.has(key)) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.setting.create({ data: { key, value } });
    }
  }
  cache = null;
}

// { UZS: 1, USD: 12000, ... } va yangilangan vaqt
async function getRates() {
  const s = await all();
  let stored = {};
  try {
    stored = JSON.parse(s.rates || "{}");
  } catch {
    stored = {};
  }
  const rates = { UZS: 1 };
  for (const code of config.currencyCodes) {
    if (code === "UZS") continue;
    const v = Number(stored[code]);
    if (Number.isFinite(v) && v > 0) rates[code] = v;
  }
  return { rates, updatedAt: s.rates_updated_at || null, auto: s.rate_auto === "true" };
}

async function publicSettings() {
  const s = await all();
  const { rates, updatedAt, auto } = await getRates();
  return {
    businessName: s.business_name,
    notifyOwnerOnStaffEntry: s.notify_owner_staff_entry === "true",
    dailyReportEnabled: s.daily_report_enabled === "true",
    debtRemindersEnabled: s.debt_reminders_enabled === "true",
    rateAuto: auto,
    rates,
    ratesUpdatedAt: updatedAt,
  };
}

module.exports = { all, get, getBool, set, setMany, ensureDefaults, getRates, publicSettings };
