// Sozlamalar va o'zgaruvchilar (.env faylidan o'qiladi)
const path = require("path");
const crypto = require("crypto");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  quiet: true,
});

const ROOT = path.join(__dirname, "..", "..");

function toInt(value, fallback) {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toHour(value, fallback) {
  const n = toInt(value, fallback);
  return n >= 0 && n <= 23 ? n : fallback;
}

// Neon manzilini Prisma uchun qulay ko'rinishga keltiradi:
//  - "-pooler" (PgBouncer) o'rniga to'g'ridan-to'g'ri ulanish
//  - channel_binding parametrini olib tashlaydi
//  - sslmode / connect_timeout / connection_limit qo'shadi
function normalizeDatabaseUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
    url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
    url.searchParams.delete("channel_binding");
    url.searchParams.delete("pgbouncer");
    if (!isLocal && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "30");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
    return url.toString();
  } catch {
    return value;
  }
}

function normalizeWebAppUrl(raw) {
  const value = String(raw || "").trim().replace(/\/+$/, "");
  return /^https:\/\//i.test(value) ? value : "";
}

// Adashtirib bo'ladigan belgilarsiz (0/O, 1/I) 8 belgilik tasodifiy kod
function makeSetupCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

const botToken = String(process.env.BOT_TOKEN || "").trim();

const config = {
  env: process.env.NODE_ENV || "development",
  root: ROOT,
  port: toInt(process.env.PORT, 3000),

  botToken,
  // false qilinsa server ishlaydi, lekin bot Telegram'dan xabar olmaydi (sinov uchun)
  botPolling: String(process.env.BOT_POLLING ?? "true").toLowerCase() !== "false",

  databaseUrl: normalizeDatabaseUrl(process.env.DATABASE_URL),

  adminPassword: String(process.env.ADMIN_PASSWORD || ""),
  jwtSecret:
    String(process.env.JWT_SECRET || "").trim() ||
    crypto.createHmac("sha256", "moliya-admin-jwt").update(botToken || "no-token").digest("hex"),
  jwtExpiresIn: "12h",

  webAppUrl: normalizeWebAppUrl(process.env.WEBAPP_URL),
  // "auto": ngrok bo'lsa uni, bo'lmasa tools/cloudflared.exe ni o'zi ishga tushiradi. "off": tunnel ochilmaydi.
  tunnel: String(process.env.TUNNEL || "auto").trim().toLowerCase() === "off" ? "off" : "auto",
  ownerTelegramId: process.env.OWNER_TELEGRAM_ID ? String(process.env.OWNER_TELEGRAM_ID).trim() : "",
  businessName: String(process.env.BUSINESS_NAME || "Mening biznesim").trim() || "Mening biznesim",

  // Toshkent vaqti (UTC+5, yozgi/qishki vaqt yo'q)
  timezone: "Asia/Tashkent",
  tzOffsetHours: 5,

  dailyReportHour: toHour(process.env.DAILY_REPORT_HOUR, 21),
  debtReminderHour: toHour(process.env.DEBT_REMINDER_HOUR, 9),

  // Qo'llab-quvvatlanadigan valyutalar
  currencies: {
    UZS: { code: "UZS", symbol: "so'm", label: "So'm", position: "suffix" },
    USD: { code: "USD", symbol: "$", label: "AQSH dollari", position: "prefix" },
    EUR: { code: "EUR", symbol: "€", label: "Yevro", position: "prefix" },
    RUB: { code: "RUB", symbol: "₽", label: "Rubl", position: "suffix" },
  },
  baseCurrency: "UZS",

  // Bir martalik "egasini aniqlash" kodi (faqat egasi hali yo'q bo'lganda ishlatiladi)
  ownerSetupCode: makeSetupCode(),

  paths: {
    miniApp: path.join(ROOT, "mini-app", "dist"),
    adminPanel: path.join(ROOT, "admin-panel", "dist"),
  },

  // Sinov uchun: ngrok manzilini qidiriladigan lokal portlar
  ngrokApiPorts: [4040, 4041, 4042],
};

config.currencyCodes = Object.keys(config.currencies);

// Majburiy sozlamalar tekshiruvi. Muammolar ro'yxatini qaytaradi.
config.validate = function validate() {
  const problems = [];
  if (!config.botToken) {
    problems.push("BOT_TOKEN kiritilmagan. BotFather bergan tokenni .env fayliga yozing.");
  } else if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(config.botToken)) {
    problems.push("BOT_TOKEN noto'g'ri ko'rinadi. Tokenni BotFather'dan to'liq nusxalang (masalan 123456:ABC...).");
  }
  if (!config.databaseUrl) {
    problems.push("DATABASE_URL kiritilmagan. Neon'dagi connection string'ni .env fayliga yozing.");
  } else if (!/^postgres(ql)?:\/\//i.test(config.databaseUrl)) {
    problems.push("DATABASE_URL 'postgresql://' bilan boshlanishi kerak.");
  }
  if (config.adminPassword.length < 8) {
    problems.push("ADMIN_PASSWORD kiritilmagan yoki 8 belgidan qisqa. .env faylida o'zingiz uchun parol belgilang.");
  }
  return problems;
};

module.exports = config;
