// PostgreSQL (Neon) bilan Prisma orqali ulanish
const { PrismaClient, Prisma } = require("@prisma/client");
const config = require("../config/default");

const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
const TRANSIENT_MESSAGE =
  /(closed the connection|connection (was )?(reset|terminated|closed)|ECONNRESET|Can't reach database server|timed out fetching a new connection)/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Neon bepul rejimida baza "uxlab qoladi" — birinchi so'rov vaqtincha xato berishi mumkin
function isTransient(err) {
  if (!err) return false;
  if (err.code && TRANSIENT_CODES.has(err.code)) return true;
  return TRANSIENT_MESSAGE.test(String(err.message || ""));
}

const base = new PrismaClient({
  datasourceUrl: config.databaseUrl || undefined,
  log: ["error"],
});

const prisma = base.$extends({
  name: "transient-retry",
  query: {
    async $allOperations({ args, query }) {
      const attempts = 3;
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await query(args);
        } catch (err) {
          if (attempt >= attempts || !isTransient(err)) throw err;
          await sleep(600 * attempt);
        }
      }
    },
  },
});

// Ishga tushishda bazani "uyg'otish" va ulanishni tekshirish
async function connect({ retries = 6, log = console.log } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await base.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      if (err.code === "P1000") {
        throw new Error("Bazaga kirib bo'lmadi: DATABASE_URL ichidagi foydalanuvchi yoki parol noto'g'ri.");
      }
      if (attempt === retries) {
        throw new Error(
          `Bazaga ulanib bo'lmadi. DATABASE_URL to'g'riligini va internetni tekshiring. (${err.message.split("\n").pop()})`
        );
      }
      log(`   Baza bilan ulanishga urinilmoqda (${attempt}/${retries})...`);
      await sleep(1500 * attempt);
    }
  }
}

// Migratsiya qilinganini tekshirish
async function checkSchema() {
  try {
    await base.user.count();
  } catch (err) {
    if (err.code === "P2021" || err.code === "P2022") {
      throw new Error("Baza jadvallari topilmadi. Avval 'npm run db:setup' buyrug'ini ishga tushiring.");
    }
    throw err;
  }
}

async function disconnect() {
  await base.$disconnect();
}

module.exports = { prisma, Prisma, connect, checkSchema, disconnect, isTransient };
