// Prisma buyruqlarini .env dagi (Neon) manzil bilan xavfsiz ishga tushiradi.
// Misol: node scripts/prisma-cli.js migrate deploy
const { spawnSync } = require("child_process");
const path = require("path");
const config = require("../src/config/default");

if (!config.databaseUrl) {
  console.error("\n❌ DATABASE_URL kiritilmagan. Neon manzilini .env fayliga yozing.\n");
  process.exit(1);
}

const args = process.argv.slice(2);
const bin = path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js");

const result = spawnSync(process.execPath, [bin, ...args], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    DATABASE_URL: config.databaseUrl,
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
  },
});

process.exit(result.status === null ? 1 : result.status);
