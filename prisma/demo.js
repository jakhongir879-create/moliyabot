// SINOV MA'LUMOTLARI: hisobotlar va grafiklar qanday ko'rinishini tekshirish uchun.
//   npm run demo         — namunaviy operatsiyalar va qarzlar qo'shadi
//   npm run demo:clear   — faqat shu namunaviy ma'lumotlarni o'chiradi
// Namunaviy yozuvlarning izohi "[DEMO]" bilan boshlanadi.
const config = require("../src/config/default");

const MARK = "[DEMO]";

// Har safar bir xil natija beradigan oddiy tasodifiy son generatori
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  if (!config.databaseUrl) {
    console.error("\n❌ DATABASE_URL kiritilmagan. Neon manzilini .env fayliga yozing.\n");
    process.exit(1);
  }

  const db = require("../src/database/connection");
  const Debt = require("../src/models/Debt");
  const Account = require("../src/models/Account");
  const D = require("../src/utils/date");
  const { prisma } = db;

  await db.connect();
  await db.checkSchema();

  // ---------- TOZALASH ----------
  const clear = async () => {
    const debts = await prisma.debt.findMany({ where: { note: { startsWith: MARK } }, select: { id: true } });
    for (const d of debts) {
      // eslint-disable-next-line no-await-in-loop
      await Debt.remove(d.id);
    }
    const removed = await prisma.transaction.deleteMany({ where: { note: { startsWith: MARK } } });
    const demoAccount = await prisma.account.findFirst({ where: { name: "Dollar (namuna)" } });
    if (demoAccount) {
      const used = await prisma.transaction.count({
        where: { OR: [{ accountId: demoAccount.id }, { toAccountId: demoAccount.id }] },
      });
      if (!used) await prisma.account.delete({ where: { id: demoAccount.id } });
    }
    return { transactions: removed.count, debts: debts.length };
  };

  if (process.argv[2] === "clear") {
    const r = await clear();
    console.log(`🧹 O'chirildi: ${r.transactions} ta operatsiya, ${r.debts} ta qarz.`);
    await db.disconnect();
    return;
  }

  await clear();

  // ---------- YARATISH ----------
  const cash = await prisma.account.findFirst({ where: { name: "Naqd pul", isArchived: false } });
  const card = await prisma.account.findFirst({ where: { name: "Plastik karta", isArchived: false } });
  if (!cash || !card) {
    console.error("❌ Avval 'npm run db:seed' ni ishga tushiring.");
    process.exit(1);
  }
  const usd = await Account.create({ name: "Dollar (namuna)", type: "CASH", currency: "USD", initialBalance: 500, icon: "💲" });

  const cats = {};
  for (const c of await prisma.category.findMany()) cats[c.name] = c.id;
  const need = (name) => {
    if (!cats[name]) throw new Error(`Toifa topilmadi: ${name}. Avval 'npm run db:seed' ni ishga tushiring.`);
    return cats[name];
  };

  const rand = rng(20260920);
  const between = (min, max, step = 1000) => Math.round((min + rand() * (max - min)) / step) * step;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const rows = [];
  const add = (date, type, amount, account, categoryName, note) =>
    rows.push({
      type,
      amount,
      currency: account.currency || "UZS",
      accountId: account.id,
      categoryId: need(categoryName),
      note: `${MARK} ${note}`,
      date,
    });

  const today = D.startOfDay();
  const atHour = (dayStart, hour, minute = 0) => new Date(dayStart.getTime() + (hour * 60 + minute) * 60000);
  const incomeNotes = ["kunlik savdo", "mijoz to'lovi", "buyurtma", "ulgurji savdo"];

  for (let back = 60; back >= 0; back -= 1) {
    const day = D.addDays(today, -back);
    const weekday = new Date(day.getTime() + config.tzOffsetHours * D.HOUR).getUTCDay();
    const busy = weekday !== 0; // yakshanba — sokin kun

    const sales = busy ? 2 + Math.floor(rand() * 3) : 1;
    for (let i = 0; i < sales; i += 1) {
      const account = rand() > 0.45 ? cash : card;
      add(atHour(day, 9 + i * 3, Math.floor(rand() * 50)), "INCOME", between(250000, 2400000), account, "Savdo tushumi", pick(incomeNotes));
    }
    if (rand() > 0.6) add(atHour(day, 15, 20), "INCOME", between(150000, 900000), card, "Xizmat ko'rsatish", "xizmat haqi");

    if (rand() > 0.25) add(atHour(day, 11, 10), "EXPENSE", between(300000, 1600000), rand() > 0.5 ? cash : card, "Tovar xaridi", "tovar olindi");
    if (rand() > 0.55) add(atHour(day, 13, 5), "EXPENSE", between(20000, 90000, 5000), cash, "Ovqatlanish", "tushlik");
    if (rand() > 0.6) add(atHour(day, 17, 40), "EXPENSE", between(15000, 80000, 5000), cash, "Transport", "taksi / benzin");
    if (rand() > 0.85) add(atHour(day, 12, 30), "EXPENSE", between(100000, 500000, 10000), card, "Reklama", "Telegram reklama");

    const dom = new Date(day.getTime() + config.tzOffsetHours * D.HOUR).getUTCDate();
    if (dom === 5) add(atHour(day, 10, 0), "EXPENSE", 3500000, card, "Ijara", "oylik ijara");
    if (dom === 10 || dom === 25) add(atHour(day, 16, 0), "EXPENSE", 4200000, card, "Ish haqi", dom === 10 ? "avans" : "oylik maosh");
    if (dom === 12) add(atHour(day, 10, 30), "EXPENSE", between(400000, 600000, 10000), cash, "Kommunal xizmatlar", "svet, gaz, suv");
  }

  // Dollar hisobi: bir nechta operatsiya
  add(atHour(D.addDays(today, -20), 11), "INCOME", 350, usd, "Savdo tushumi", "eksport to'lovi");
  add(atHour(D.addDays(today, -9), 14), "EXPENSE", 120, usd, "Tovar xaridi", "import tovar");
  add(atHour(D.addDays(today, -3), 12), "INCOME", 200, usd, "Xizmat ko'rsatish", "chet ellik mijoz");
  const usdRows = rows.filter((r) => r.accountId === usd.id);
  for (const r of usdRows) r.currency = "USD";

  // Hozirdan keyingi vaqtga tushib qolganlarini olib tashlaymiz
  const now = Date.now();
  const valid = rows.filter((r) => r.date.getTime() <= now);
  await prisma.transaction.createMany({ data: valid });

  // Qarzlar
  const debtSpecs = [
    { type: "RECEIVABLE", personName: "Aziz aka (do'kon)", phone: "+998 90 123 45 67", amount: 3200000, dueOffset: -4, note: "tovar nasiyaga olingan", pay: 1000000 },
    { type: "RECEIVABLE", personName: "Malika opa", phone: "+998 93 555 12 34", amount: 1500000, dueOffset: 3, note: "buyurtma uchun qoldiq", pay: 0 },
    { type: "PAYABLE", personName: "Ulgurji ta'minotchi", phone: "+998 71 200 30 40", amount: 6800000, dueOffset: 8, note: "mahsulot qarzi", pay: 2000000 },
  ];
  for (const spec of debtSpecs) {
    // eslint-disable-next-line no-await-in-loop
    const debt = await Debt.create(
      {
        type: spec.type,
        personName: spec.personName,
        phone: spec.phone,
        amount: spec.amount,
        currency: "UZS",
        dueDate: D.ymd(D.addDays(today, spec.dueOffset)),
        note: `${MARK} ${spec.note}`,
        moneyMoved: false,
      },
      { userId: null }
    );
    if (spec.pay) {
      // eslint-disable-next-line no-await-in-loop
      await Debt.addPayment(debt.id, { amount: spec.pay, accountId: cash.id }, { userId: null });
    }
  }

  console.log(`✅ Namunaviy ma'lumotlar qo'shildi: ${valid.length} ta operatsiya va ${debtSpecs.length} ta qarz.`);
  console.log("   O'chirish uchun: npm run demo:clear");
  await db.disconnect();
}

main().catch((err) => {
  console.error("\n❌ Xatolik:", err.message, "\n");
  process.exit(1);
});
