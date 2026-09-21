// Bot handlerlarini ulash
const h = require("../controllers/botController");

// Telegram bir yangilanishni ikki marta yuborsa (webhook qayta urinishi), ikkinchisini e'tiborsiz qoldiramiz:
// aks holda bitta operatsiya ikki marta yozilib ketishi mumkin.
const seenUpdates = new Set();
const seenOrder = [];
function dedupeUpdates(ctx, next) {
  const id = ctx.update && ctx.update.update_id;
  if (id === undefined) return next();
  if (seenUpdates.has(id)) return undefined;
  seenUpdates.add(id);
  seenOrder.push(id);
  if (seenOrder.length > 2000) seenUpdates.delete(seenOrder.shift());
  return next();
}

function registerBotRoutes(bot) {
  bot.use(dedupeUpdates);
  bot.use(h.access);

  // Buyruqlar
  bot.command("start", h.guard(h.start));
  bot.command("id", h.guard(h.id));
  bot.command(["yordam", "help"], h.guard(h.help));
  bot.command(["ilova", "app"], h.guard(h.openApp));
  bot.command("kirim", h.guard((ctx) => h.entryCommand(ctx, "INCOME")));
  bot.command("chiqim", h.guard((ctx) => h.entryCommand(ctx, "EXPENSE")));
  bot.command("bekor", h.guard(h.cancelCommand));
  bot.command("balans", h.guard(h.requireManager(h.balance)));
  bot.command("hisobot", h.guard(h.requireManager(h.reportCommand)));
  bot.command("qarzlar", h.guard(h.requireManager(h.debts)));
  bot.command("bugun", h.guard(h.todayCommand));

  // Pastki menyu tugmalari
  bot.hears(h.LABELS.income, h.guard((ctx) => h.promptEntry(ctx, "INCOME")));
  bot.hears(h.LABELS.expense, h.guard((ctx) => h.promptEntry(ctx, "EXPENSE")));
  bot.hears(h.LABELS.balance, h.guard(h.requireManager(h.balance)));
  bot.hears(h.LABELS.report, h.guard(h.requireManager((ctx) => h.reportCommand(ctx))));
  bot.hears(h.LABELS.debts, h.guard(h.requireManager(h.debts)));
  bot.hears(h.LABELS.help, h.guard(h.help));
  bot.hears(h.LABELS.myToday, h.guard(h.myToday));

  // Inline tugmalar
  bot.callbackQuery(/^qt:(\w+):(INCOME|EXPENSE)$/, h.guard(h.onDraftType));
  bot.callbackQuery(/^qc:(\w+):(\d+)$/, h.guard(h.onDraftCategory));
  bot.callbackQuery(/^qa:(\w+):(\d+)$/, h.guard(h.onDraftAccount));
  bot.callbackQuery(/^qx:(\w+)$/, h.guard(h.onCancel));
  bot.callbackQuery(/^qu:(\d+)$/, h.guard(h.onUndo));
  bot.callbackQuery(/^vy:(\w+)$/, h.guard(h.onVoiceYes));
  bot.callbackQuery(/^vn:(\w+)$/, h.guard(h.onVoiceNo));
  bot.callbackQuery(/^rp:(\w+)$/, h.guard(h.requireManager(h.onReportPeriod)));
  bot.callbackQuery(/^rx:(\w+)$/, h.guard(h.requireManager(h.onReportExport)));
  bot.callbackQuery(/^usr:(\d+):(STAFF|ACCOUNTANT|BLOCK)$/, h.guard(h.onUserDecision));

  // Boshqa xabarlar
  bot.on("message:text", h.guard(h.onText));
  bot.on("message:voice", h.guard(h.onVoice));
  bot.on("message", h.guard(h.onOther));

  bot.catch(h.onError);
}

module.exports = { registerBotRoutes, setupProfile: h.setupProfile };
