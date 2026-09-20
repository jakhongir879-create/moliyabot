// Moliya Bot — asosiy ishga tushirish fayli
const config = require("./config/default");
const state = require("./core/state");

const line = (text = "") => console.log(text);
const rule = () => line("─".repeat(58));

function fail(title, details = []) {
  line();
  line(`❌ ${title}`);
  for (const d of details) line(`   ${d}`);
  line();
  process.exit(1);
}

// Ikkinchi nusxa ishga tushib ketmasligi uchun: shu portda dastur allaqachon ishlayaptimi?
// (Ikki nusxa bir bot tokenini bir vaqtda ishlatsa, Telegram birini to'xtatib qo'yadi.)
async function alreadyRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${config.port}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json && json.ok === true);
  } catch {
    return false;
  }
}

async function main() {
  line();
  line("💼 Moliya Bot ishga tushmoqda...");

  if (await alreadyRunning()) {
    fail(`Moliya Bot allaqachon ishlayapti (${config.port}-port). Ikkinchi nusxa ochilmadi — ishlayotgan botga zarar yetmaydi.`, [
      "Avvalgi oynani (terminalni) yoping yoki unda Ctrl + C bosing, so'ng qayta ishga tushiring.",
    ]);
  }

  // 1) Sozlamalarni tekshirish
  const problems = config.validate();
  if (problems.length) {
    fail("Sozlamalarda muammo bor (.env fayli):", [
      ...problems.map((p) => `• ${p}`),
      "",
      "Faylni to'ldirib, buyruqni qayta ishga tushiring: npm start",
    ]);
  }

  // 2) Baza
  const db = require("./database/connection");
  line("🗄  Bazaga ulanmoqda...");
  try {
    await db.connect({ log: line });
    await db.checkSchema();
  } catch (err) {
    fail(err.message);
  }
  state.databaseOk = true;

  const { ensureSystemData } = require("./services/bootstrap.service");
  await ensureSystemData();

  // 3) Web-server
  const { createApp } = require("./app");
  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(config.port, () => resolve(s));
    s.on("error", reject);
  }).catch((err) => {
    if (err.code === "EADDRINUSE") {
      fail(`${config.port}-port band. Dastur allaqachon ishlayotgan bo'lishi mumkin.`, [
        "Boshqa terminal oynasini yoping yoki .env faylida PORT ni o'zgartiring.",
      ]);
    }
    fail(`Serverni ishga tushirib bo'lmadi: ${err.message}`);
  });

  // 4) Telegram bot
  const bot = require("./core/bot");
  const { registerBotRoutes, setupProfile } = require("./routes/bot.routes");
  registerBotRoutes(bot);

  let botInfo = null;
  for (let attempt = 1; attempt <= 3 && !botInfo; attempt += 1) {
    try {
      botInfo = await bot.api.getMe();
    } catch (err) {
      if (err.error_code === 401) {
        server.close();
        fail("BOT_TOKEN noto'g'ri yoki bekor qilingan.", [
          "BotFather'dan tokenni qayta nusxalab, .env fayliga yozing.",
        ]);
      }
      if (attempt === 3) {
        state.botError = "Telegram bilan aloqa yo'q";
        line(`⚠️  Telegram bilan aloqa o'rnatib bo'lmadi: ${err.message}`);
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  if (botInfo) {
    state.botUsername = botInfo.username;
    state.botName = botInfo.first_name;
    bot.botInfo = botInfo;
    await setupProfile(bot);

    if (config.botPolling) {
      bot
        .start({
          allowed_updates: ["message", "callback_query"],
          onStart: () => {
            state.botOnline = true;
          },
        })
        .catch((err) => {
          state.botOnline = false;
          state.botError = err.description || err.message;
          if (err.error_code === 409) {
            line("❌ Bu bot boshqa joyda ham ishlayapti (boshqa terminal yoki kompyuter). Ikkinchisini to'xtating.");
          } else {
            line(`❌ Bot to'xtadi: ${state.botError}`);
          }
        });
      state.botOnline = true;
    }
  }

  // 5) Avtomatik xabarlar va Mini App manzili (tunnel)
  require("./services/scheduler.service").start();
  const tunnel = require("./services/tunnel.service");
  if (botInfo) tunnel.start(line);

  // 6) Xulosa
  const User = require("./models/User");
  const ownerExists = await User.hasOwner();
  line();
  rule();
  line("  💼  MOLIYA BOT TAYYOR");
  rule();
  line(`  Bot          : ${botInfo ? `@${botInfo.username}` : "ulanmagan"}`);
  line(`  Admin Panel  : http://localhost:${config.port}/admin`);
  line(`  Mini App     : ${tunnel.describe()}`);
  rule();
  if (!ownerExists && botInfo) {
    line();
    line("  👑 EGASI HALI BELGILANMAGAN");
    line(`  Telegram'da @${botInfo.username} botiga quyidagini yuboring:`);
    line();
    line(`        /start ${config.ownerSetupCode}`);
    line();
    rule();
  }
  line("  To'xtatish: Ctrl + C");
  line();

  // 7) To'xtatish
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    line("\nTo'xtatilmoqda...");
    try {
      require("./services/scheduler.service").stop();
      require("./services/tunnel.service").stop();
      if (state.botOnline) await bot.stop();
      server.close();
      await db.disconnect();
    } catch {
      // e'tiborsiz
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

process.on("unhandledRejection", (err) => {
  console.error("[ushlanmagan xatolik]", err && err.stack ? err.stack : err);
});

main().catch((err) => {
  console.error("Dasturni ishga tushirib bo'lmadi:", err && err.stack ? err.stack : err);
  process.exit(1);
});
