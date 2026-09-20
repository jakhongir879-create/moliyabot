// Boshlang'ich ma'lumotlarni bazaga yozadi: toifalar, hisoblar, sozlamalar.
// Ishga tushirish: npm run db:seed  (bir necha marta ishga tushirish xavfsiz)
const config = require("../src/config/default");

async function main() {
  if (!config.databaseUrl) {
    console.error("\n❌ DATABASE_URL kiritilmagan. Neon manzilini .env fayliga yozing.\n");
    process.exit(1);
  }

  const db = require("../src/database/connection");
  const Category = require("../src/models/Category");
  const Account = require("../src/models/Account");
  const Setting = require("../src/models/Setting");

  console.log("🌱 Boshlang'ich ma'lumotlar yozilmoqda...");
  await db.connect();
  await db.checkSchema();

  await Category.ensureSystem();
  await Category.ensureDefaults();
  await Account.ensureDefaults();
  await Setting.ensureDefaults();
  await Setting.set("defaults_seeded", "true");

  const [categories, accounts] = await Promise.all([
    db.prisma.category.count({ where: { isSystem: false } }),
    db.prisma.account.count(),
  ]);
  console.log(`✅ Tayyor: ${categories} ta toifa, ${accounts} ta hisob.`);
  await db.disconnect();
}

main().catch((err) => {
  console.error("\n❌ Xatolik:", err.message, "\n");
  process.exit(1);
});
