// Bot logikasi: buyruqlar, tezkor kiritish, hisobotlar, ruxsat so'rovlari
const crypto = require("crypto");
const { InlineKeyboard, InputFile } = require("grammy");
const config = require("../config/default");
const state = require("../core/state");
const User = require("../models/User");
const Account = require("../models/Account");
const Category = require("../models/Category");
const Transaction = require("../models/Transaction");
const Debt = require("../models/Debt");
const Setting = require("../models/Setting");
const AuditLog = require("../models/AuditLog");
const Report = require("../services/report.service");
const { buildWorkbook } = require("../services/export.service");
const notify = require("../services/notify.service");
const { actorFromUser } = require("../middlewares/auth.middleware");
const { parseQuickEntry, matchCategoryByText } = require("../utils/amountParser");
const { parseVoiceEntry } = require("../utils/voiceEntry");
const stt = require("../services/stt.service");
const { LABELS, mainKeyboard, openAppKeyboard } = require("../utils/keyboards");
const { renderReport, renderBalances, renderDebtSummary } = require("../utils/reportText");
const { esc } = require("../utils/html");
const { formatMoney } = require("../utils/money");
const { isManager, ROLE_LABELS } = require("../utils/permissions");
const D = require("../utils/date");

const HTML = { parse_mode: "HTML", link_preview_options: { is_disabled: true } };

// ---------------------------------------------------------------
// Vaqtinchalik holatlar (xotirada saqlanadi)
// ---------------------------------------------------------------

const drafts = new Map(); // tezkor kiritish qoralamalari
const awaiting = new Map(); // "Kirim" / "Chiqim" tugmasidan keyin summa kutilmoqda
const setupAttempts = new Map(); // egasini aniqlash kodini taxmin qilish urinishlari
const accessNotified = new Map(); // ruxsat so'rovi egasiga oxirgi marta qachon yuborilgani
const voiceDrafts = new Map(); // ovozli xabardan olingan, tasdiq kutayotgan yozuvlar

const DRAFT_TTL = 30 * 60 * 1000;
const AWAIT_TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, d] of drafts) if (now - d.at > DRAFT_TTL) drafts.delete(id);
  for (const [id, v] of voiceDrafts) if (now - v.at > DRAFT_TTL) voiceDrafts.delete(id);
  for (const [id, a] of awaiting) if (now - a.at > AWAIT_TTL) awaiting.delete(id);
}, 5 * 60 * 1000).unref();

const newDraftId = () => crypto.randomBytes(4).toString("hex");

// ---------------------------------------------------------------
// Yordamchi funksiyalar
// ---------------------------------------------------------------

// Xabarni tahrirlash (callback bo'lsa) yoki yangi xabar yuborish
async function respond(ctx, text, reply_markup, { edit } = {}) {
  const extra = { ...HTML, ...(reply_markup ? { reply_markup } : {}) };
  if (edit && ctx.callbackQuery) {
    try {
      return await ctx.editMessageText(text, extra);
    } catch (err) {
      if (/message is not modified/i.test(err.description || err.message)) return null;
      // tahrirlab bo'lmasa, yangi xabar yuboramiz
    }
  }
  return ctx.reply(text, extra);
}

const signedAmount = (type, amount, currency) =>
  formatMoney(type === "EXPENSE" ? -amount : amount, currency, { sign: true });

const typeLabel = (type) => (type === "INCOME" ? "Kirim" : type === "EXPENSE" ? "Chiqim" : "O'tkazma");

function requireManager(handler) {
  return async (ctx, ...rest) => {
    if (!ctx.user || !isManager(ctx.user.role)) {
      const text = "🔒 Bu bo'lim faqat egasi va buxgalter uchun.";
      if (ctx.callbackQuery) return ctx.answerCallbackQuery({ text, show_alert: true });
      return ctx.reply(text);
    }
    return handler(ctx, ...rest);
  };
}

// Xatolik yuz bersa foydalanuvchiga tushunarli xabar
function guard(handler) {
  return async (ctx, ...rest) => {
    try {
      return await handler(ctx, ...rest);
    } catch (err) {
      console.error("[bot] xatolik:", err && err.stack ? err.stack : err);
      const message =
        err && err.status && err.status < 500 && err.message
          ? `⚠️ ${esc(err.message)}`
          : "⚠️ Xatolik yuz berdi. Iltimos, birozdan so'ng qayta urinib ko'ring.";
      try {
        if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: message.replace(/<[^>]+>/g, ""), show_alert: true });
        else await ctx.reply(message, HTML);
      } catch {
        // e'tiborsiz
      }
      return undefined;
    }
  };
}

// ---------------------------------------------------------------
// Ruxsat middleware
// ---------------------------------------------------------------

async function access(ctx, next) {
  if (!ctx.from || ctx.from.is_bot) return undefined;
  if (ctx.chat && ctx.chat.type !== "private") return undefined;

  let user = await User.findByTelegramId(ctx.from.id);
  if (user) user = await User.syncProfile(user, ctx.from);
  ctx.user = user;

  if (user && user.status === "ACTIVE") {
    await User.touch(user);
    return next();
  }

  const text = (ctx.message && ctx.message.text) || "";
  if (/^\/(start|id)(@\w+)?(\s|$)/i.test(text)) return next();

  if (ctx.callbackQuery) {
    return ctx.answerCallbackQuery({ text: "Sizga ruxsat berilmagan", show_alert: true });
  }
  if (user && user.status === "BLOCKED") return ctx.reply("Kechirasiz, sizga botdan foydalanishga ruxsat berilmagan.");
  return ctx.reply("Botdan foydalanish uchun /start ni bosing.");
}

// ---------------------------------------------------------------
// /start, /id, /yordam, /ilova
// ---------------------------------------------------------------

function verifySetupCode(telegramId, payload) {
  const tries = setupAttempts.get(telegramId) || 0;
  if (tries >= 5) return false;
  const given = String(payload || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (given && given === config.ownerSetupCode) return true;
  setupAttempts.set(telegramId, tries + 1);
  return false;
}

async function welcome(ctx, user) {
  const settings = await Setting.publicSettings();
  const lines = [
    `Assalomu alaykum, <b>${esc(user.firstName)}</b>! 👋`,
    "",
    `Men — <b>${esc(settings.businessName)}</b> uchun moliyaviy yordamchiman.`,
    "",
    "Tez yozish uchun shunchaki yuboring:",
    "<code>+500 ming savdo</code> → kirim",
    "<code>-120 ming taksi</code> → chiqim",
    "",
    "Pastdagi tugmalardan ham foydalanishingiz mumkin.",
  ];
  await ctx.reply(lines.join("\n"), { ...HTML, reply_markup: mainKeyboard(user.role) });
  if (state.webAppUrl) {
    await ctx.reply("To'liq imkoniyatlar uchun ilovani oching 👇", { reply_markup: openAppKeyboard(state.webAppUrl) });
  }
}

async function start(ctx) {
  const payload = String(ctx.match || "").trim();
  let user = ctx.user;

  if (user && user.status === "ACTIVE") return welcome(ctx, user);

  // Egasi hali belgilanmagan
  if (!(await User.hasOwner())) {
    if (payload && verifySetupCode(ctx.from.id, payload)) {
      user = await User.makeOwner(ctx.from);
      console.log(`👑 Egasi belgilandi: ${User.fullName(user)} (ID ${ctx.from.id})`);
      await ctx.reply(
        `🎉 <b>Tabriklaymiz, ${esc(user.firstName)}!</b>\nSiz botning <b>egasi</b> bo'ldingiz. Endi hamma imkoniyatlar sizda.\n\nXodimlar botga /start yuborganda sizga ruxsat so'rovi keladi.`,
        HTML
      );
      return welcome(ctx, user);
    }
    return ctx.reply(
      [
        "👋 Salom! Bu bot hali egasiga biriktirilmagan.",
        "",
        "Egasi sifatida ro'yxatdan o'tish uchun kompyuteringizdagi <b>terminalda chiqqan 8 belgili kodni</b> quyidagicha yuboring:",
        "<code>/start KOD</code>",
        "",
        `Sizning Telegram ID raqamingiz: <code>${ctx.from.id}</code>`,
      ].join("\n"),
      HTML
    );
  }

  // Egasi bor — ruxsat so'rash
  if (payload && !user) {
    // /start KOD yuborgan begona odam
    verifySetupCode(ctx.from.id, payload);
  }
  return requestAccess(ctx);
}

async function requestAccess(ctx) {
  let user = ctx.user;
  if (!user) user = await User.create(ctx.from, { role: "STAFF", status: "PENDING" });
  if (user.status === "BLOCKED") {
    return ctx.reply("Kechirasiz, sizga botdan foydalanishga ruxsat berilmagan.");
  }

  await ctx.reply(
    "⏳ <b>So'rovingiz egasiga yuborildi.</b>\nRuxsat berilgach, sizga shu yerda xabar keladi.",
    HTML
  );

  const last = accessNotified.get(user.id) || 0;
  if (Date.now() - last < 10 * 60 * 1000) return undefined;
  accessNotified.set(user.id, Date.now());

  const who = `${esc(User.fullName(user))}${user.username ? ` (@${esc(user.username)})` : ""}`;
  const kb = new InlineKeyboard()
    .text("👷 Xodim", `usr:${user.id}:STAFF`)
    .text("🧮 Buxgalter", `usr:${user.id}:ACCOUNTANT`)
    .row()
    .text("🚫 Rad etish", `usr:${user.id}:BLOCK`);
  await notify.toOwners(
    `🔔 <b>Yangi foydalanuvchi ruxsat so'radi</b>\n\n👤 ${who}\n🆔 <code>${user.telegramId}</code>\n\nQanday ruxsat berasiz?\n<i>Xodim — faqat kirim/chiqim yozadi. Buxgalter — hisobot va qarzlarni ham ko'radi.</i>`,
    { reply_markup: kb }
  );
  return undefined;
}

async function onUserDecision(ctx) {
  const [, idStr, action] = ctx.match;
  if (!ctx.user || ctx.user.role !== "OWNER") {
    return ctx.answerCallbackQuery({ text: "Faqat egasi qaror qila oladi", show_alert: true });
  }
  const target = await User.findById(Number(idStr));
  if (!target) return ctx.answerCallbackQuery({ text: "Foydalanuvchi topilmadi", show_alert: true });

  const who = esc(User.fullName(target));
  if (action === "BLOCK") {
    await User.update(target.id, { status: "BLOCKED" });
    await AuditLog.record(actorFromUser(ctx.user), "update", "user", target.id, { name: User.fullName(target), status: "BLOCKED" });
    await ctx.answerCallbackQuery({ text: "Rad etildi" });
    return respond(ctx, `🚫 <b>${who}</b> — rad etildi.`, null, { edit: true });
  }

  const updated = await User.update(target.id, { status: "ACTIVE", role: action });
  await AuditLog.record(actorFromUser(ctx.user), "update", "user", target.id, { name: User.fullName(target), role: action, status: "ACTIVE" });
  await notify.userApproved(updated);
  await ctx.answerCallbackQuery({ text: "Ruxsat berildi" });
  return respond(ctx, `✅ <b>${who}</b> — ${ROLE_LABELS[action].toLowerCase()} sifatida qabul qilindi.`, null, { edit: true });
}

function id(ctx) {
  return ctx.reply(`Sizning Telegram ID raqamingiz: <code>${ctx.from.id}</code>`, HTML);
}

function help(ctx) {
  const manager = ctx.user && isManager(ctx.user.role);
  const lines = [
    "ℹ️ <b>Yordam</b>",
    "",
    "<b>Tezkor yozish</b> (summa + izoh):",
    "<code>+500 ming savdo</code> — kirim",
    "<code>-120 ming taksi</code> — chiqim",
    "<code>-1.5 mln ijara</code>, <code>+$100 xizmat</code>",
    "",
    "«ming» = 1 000, «mln» = 1 000 000. Belgi yozmasangiz, kirim yoki chiqimligini so'rayman.",
    "",
    ...(stt.isAvailable()
      ? [
          "🎙 <b>Ovozli xabar:</b> «besh yuz ming so'm savdo» deb aytib yuboring. Eshitganimni ko'rsataman, siz tasdiqlaysiz.",
          "",
        ]
      : []),
    "<b>Buyruqlar:</b>",
    "/kirim — kirim yozish",
    "/chiqim — chiqim yozish",
  ];
  if (manager) {
    lines.push("/balans — hisoblar qoldig'i", "/hisobot — bugun / hafta / oy hisoboti", "/bugun — bugungi hisobot", "/qarzlar — qarzlar ro'yxati");
  } else {
    lines.push("/bugun — bugun kiritganlarim");
  }
  lines.push("/ilova — Mini App'ni ochish", "/bekor — joriy amalni bekor qilish");
  return ctx.reply(lines.join("\n"), HTML);
}

async function openApp(ctx) {
  if (!state.webAppUrl) {
    const owner = ctx.user && ctx.user.role === "OWNER";
    return ctx.reply(
      owner
        ? "📱 Mini App manzili hali ulanmagan.\nInternet manzili (tunnel) ochilmoqda — 10-20 soniyadan so'ng /ilova ni qayta yuboring. Agar tunnel ochilmasa, README.md dagi «Mini App uchun internet manzili» bo'limiga qarang."
        : "📱 Mini App hozircha ishlamayapti. Egasi uni ishga tushirgach ochiladi.",
      HTML
    );
  }
  return ctx.reply("📱 Ilovani ochish uchun tugmani bosing 👇", { reply_markup: openAppKeyboard(state.webAppUrl) });
}

// ---------------------------------------------------------------
// Tezkor kiritish (kirim / chiqim)
// ---------------------------------------------------------------

function promptEntry(ctx, type) {
  awaiting.set(ctx.from.id, { type, at: Date.now() });
  const income = type === "INCOME";
  const text = [
    income ? "➕ <b>Kirim</b>" : "➖ <b>Chiqim</b>",
    "Summani va izohni yozing.",
    "",
    "Masalan: <code>500 ming savdo</code>",
    "yoki <code>1.5 mln xizmat</code>, <code>$100 buyurtma</code>",
  ].join("\n");
  return ctx.reply(text, { ...HTML, reply_markup: new InlineKeyboard().text("❌ Bekor qilish", "qx:0") });
}

async function entryCommand(ctx, type) {
  const args = String(ctx.match || "").trim();
  if (args) {
    const parsed = parseQuickEntry(args, { defaultType: type });
    if (parsed) return beginEntry(ctx, { ...parsed, type });
  }
  return promptEntry(ctx, type);
}

const draftHeader = (d) =>
  `${d.type === "INCOME" ? "➕ <b>Kirim</b>" : d.type === "EXPENSE" ? "➖ <b>Chiqim</b>" : "❓ <b>Operatsiya</b>"}: <b>${
    d.type ? signedAmount(d.type, d.amount, d.currency) : formatMoney(d.amount, d.currency)
  }</b>${d.note ? `\n📝 ${esc(d.note)}` : ""}`;

async function beginEntry(ctx, parsed) {
  const draft = {
    id: newDraftId(),
    userId: ctx.user.id,
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    note: parsed.note,
    categoryId: null,
    accountId: null,
    at: Date.now(),
  };
  drafts.set(draft.id, draft);
  return proceed(ctx, draft);
}

async function proceed(ctx, draft) {
  const edit = Boolean(ctx.callbackQuery);

  if (!draft.type) {
    const kb = new InlineKeyboard()
      .text("➕ Kirim", `qt:${draft.id}:INCOME`)
      .text("➖ Chiqim", `qt:${draft.id}:EXPENSE`)
      .row()
      .text("❌ Bekor qilish", `qx:${draft.id}`);
    return respond(ctx, `${draftHeader(draft)}\n\nBu kirimmi yoki chiqimmi?`, kb, { edit });
  }

  if (!draft.categoryId) {
    const cats = await Category.list({ type: draft.type, includeSystem: false });
    const matched = matchCategoryByText(cats, draft.note);
    if (matched) {
      draft.categoryId = matched.id;
    } else {
      const kb = new InlineKeyboard();
      cats.forEach((c, i) => {
        kb.text(`${c.icon || "•"} ${c.name}`, `qc:${draft.id}:${c.id}`);
        if (i % 2 === 1) kb.row();
      });
      kb.row().text("❌ Bekor qilish", `qx:${draft.id}`);
      return respond(ctx, `${draftHeader(draft)}\n\nToifani tanlang:`, kb, { edit });
    }
  }

  if (!draft.accountId) {
    const accounts = (await Account.list()).filter((a) => a.currency === draft.currency);
    if (!accounts.length) {
      drafts.delete(draft.id);
      return respond(
        ctx,
        `⚠️ <b>${draft.currency}</b> valyutasida hisob yo'q.\nIlovada «Profil → Hisoblar» bo'limidan yangi hisob qo'shing.`,
        null,
        { edit }
      );
    }
    if (accounts.length === 1) {
      draft.accountId = accounts[0].id;
    } else {
      const kb = new InlineKeyboard();
      accounts.forEach((a, i) => {
        kb.text(`${a.icon || "🏦"} ${a.name}`, `qa:${draft.id}:${a.id}`);
        if (i % 2 === 1) kb.row();
      });
      kb.row().text("❌ Bekor qilish", `qx:${draft.id}`);
      return respond(ctx, `${draftHeader(draft)}\n\nQaysi hisobga?`, kb, { edit });
    }
  }

  return finalizeDraft(ctx, draft, edit);
}

async function finalizeDraft(ctx, draft, edit) {
  drafts.delete(draft.id);
  const user = ctx.user;
  const tx = await Transaction.create(
    {
      type: draft.type,
      amount: draft.amount,
      accountId: draft.accountId,
      categoryId: draft.categoryId,
      note: draft.note,
    },
    actorFromUser(user)
  );
  await AuditLog.record(actorFromUser(user), "create", "transaction", tx.id, {
    type: tx.type,
    amount: tx.amount,
    currency: tx.currency,
    category: tx.category && tx.category.name,
    via: "bot",
  });

  let text = notify.receiptText(tx);
  if (isManager(user.role)) {
    const balance = await Account.balanceOf(tx.accountId);
    text += `\n💰 Hisob qoldig'i: <b>${formatMoney(balance, tx.currency)}</b>`;
  }
  const kb = new InlineKeyboard().text("↩️ Bekor qilish", `qu:${tx.id}`);
  await respond(ctx, text, kb, { edit });

  notify.transactionCreated({ user, tx, viaBot: true });
  return undefined;
}

function getDraft(ctx, draftId) {
  const draft = drafts.get(draftId);
  if (!draft) {
    ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan. Qaytadan yozing.", show_alert: true });
    return null;
  }
  if (draft.userId !== ctx.user.id) {
    ctx.answerCallbackQuery({ text: "Bu so'rov sizniki emas", show_alert: true });
    return null;
  }
  return draft;
}

async function onDraftType(ctx) {
  const draft = getDraft(ctx, ctx.match[1]);
  if (!draft) return undefined;
  draft.type = ctx.match[2];
  await ctx.answerCallbackQuery();
  return proceed(ctx, draft);
}

async function onDraftCategory(ctx) {
  const draft = getDraft(ctx, ctx.match[1]);
  if (!draft) return undefined;
  draft.categoryId = Number(ctx.match[2]);
  await ctx.answerCallbackQuery();
  return proceed(ctx, draft);
}

async function onDraftAccount(ctx) {
  const draft = getDraft(ctx, ctx.match[1]);
  if (!draft) return undefined;
  draft.accountId = Number(ctx.match[2]);
  await ctx.answerCallbackQuery();
  return proceed(ctx, draft);
}

async function onCancel(ctx) {
  const draftId = ctx.match[1];
  if (draftId !== "0") drafts.delete(draftId);
  awaiting.delete(ctx.from.id);
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  return respond(ctx, "❌ Bekor qilindi.", null, { edit: true });
}

async function cancelCommand(ctx) {
  awaiting.delete(ctx.from.id);
  for (const [draftId, d] of drafts) if (d.userId === ctx.user.id) drafts.delete(draftId);
  return ctx.reply("❌ Bekor qilindi.");
}

async function onUndo(ctx) {
  const txId = Number(ctx.match[1]);
  const user = ctx.user;
  let removed;
  try {
    removed = await Transaction.remove(txId, async (tx) => {
      if (isManager(user.role)) return;
      const own = tx.createdById === user.id;
      const fresh = Date.now() - new Date(tx.createdAt).getTime() < 15 * 60 * 1000;
      if (!own || !fresh) throw new Error("Faqat o'zingiz kiritgan operatsiyani 15 daqiqa ichida bekor qila olasiz");
    });
  } catch (err) {
    return ctx.answerCallbackQuery({ text: err.message || "Bekor qilib bo'lmadi", show_alert: true });
  }
  await AuditLog.record(actorFromUser(user), "delete", "transaction", txId, {
    type: removed.type,
    amount: removed.amount,
    currency: removed.currency,
    via: "bot-undo",
  });
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  return respond(
    ctx,
    `↩️ <b>Bekor qilindi</b>\n<s>${typeLabel(removed.type)}: ${formatMoney(removed.amount, removed.currency)}</s>`,
    null,
    { edit: true }
  );
}

// ---------------------------------------------------------------
// Matnli xabarlar
// ---------------------------------------------------------------

async function onText(ctx) {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) {
    return ctx.reply("Bunday buyruq topilmadi. /yordam ni bosing.");
  }

  const wait = awaiting.get(ctx.from.id);
  const parsed = parseQuickEntry(text, { defaultType: wait && Date.now() - wait.at < AWAIT_TTL ? wait.type : null });

  if (!parsed) {
    return ctx.reply(
      wait
        ? "Summani tushunolmadim 🤔 Masalan: <code>500 ming savdo</code>"
        : "Tushunmadim 🤔\nSumma va izohni yozing, masalan: <code>+500 ming savdo</code> yoki <code>-120 ming taksi</code>.\nYordam: /yordam",
      HTML
    );
  }

  awaiting.delete(ctx.from.id);
  return beginEntry(ctx, parsed);
}

function onOther(ctx) {
  return ctx.reply("Faqat matnli va ovozli xabarlarni tushunaman. Masalan: <code>+500 ming savdo</code>", HTML);
}

// ---------------------------------------------------------------
// Ovozli xabarlar
// ---------------------------------------------------------------

const VOICE_HINT = "Masalan: «besh yuz ming so'm savdo» yoki «yuz yigirma ming so'm taksi chiqim».";

async function downloadTelegramFile(filePath) {
  const res = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`);
  if (!res.ok) throw new Error(`Telegram faylni bermadi (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function onVoice(ctx) {
  const voice = ctx.message.voice;
  const availability = stt.status();
  if (!availability.ok) {
    console.warn(`[ovoz] o'chiq: ${availability.reason}`);
    return ctx.reply("🎙 Ovozli xabarni tanish hozircha yoqilmagan. Iltimos, matn bilan yozing: <code>+500 ming savdo</code>", HTML);
  }
  if (voice.duration > config.sttMaxSeconds) {
    return ctx.reply(`🎙 Ovozli xabar juda uzun. ${config.sttMaxSeconds} soniyagacha, qisqa qilib yuboring.`);
  }

  await ctx.replyWithChatAction("typing").catch(() => undefined);
  const file = await ctx.api.getFile(voice.file_id);
  const audio = await downloadTelegramFile(file.file_path);

  let heard;
  try {
    heard = await stt.transcribe(audio);
  } catch (err) {
    console.error("[ovoz] tanib bo'lmadi:", err && err.stack ? err.stack : err);
    return ctx.reply("🎙 Ovozni tanib bo'lmadi. Iltimos, qayta yuboring yoki matn bilan yozing.");
  }
  console.log(`[ovoz] ${ctx.from.id}: «${heard}»`);

  if (!heard) return ctx.reply("🎙 Hech narsa eshitilmadi. Aniqroq va balandroq gapirib, qayta yuboring.");

  const wait = awaiting.get(ctx.from.id);
  const { parsed } = parseVoiceEntry(heard, { defaultType: wait && Date.now() - wait.at < AWAIT_TTL ? wait.type : null });
  if (!parsed) {
    return ctx.reply(`🎙 Eshitdim: <i>«${esc(heard)}»</i>\n\nLekin summani topa olmadim. Summani aniq ayting. ${VOICE_HINT}`, HTML);
  }

  // Ovoz xato tanilishi mumkin, shuning uchun summani saqlashdan oldin tasdiqlatamiz
  const id = newDraftId();
  voiceDrafts.set(id, { userId: ctx.user.id, parsed, at: Date.now() });
  const kb = new InlineKeyboard().text("✅ To'g'ri", `vy:${id}`).text("❌ Noto'g'ri", `vn:${id}`);
  return ctx.reply(`🎙 Eshitdim: <i>«${esc(heard)}»</i>\n\n${draftHeader(parsed)}\n\nTo'g'rimi?`, { ...HTML, reply_markup: kb });
}

function getVoiceDraft(ctx, id) {
  const v = voiceDrafts.get(id);
  if (!v) {
    ctx.answerCallbackQuery({ text: "Bu so'rov eskirgan. Qaytadan ayting.", show_alert: true });
    return null;
  }
  if (v.userId !== ctx.user.id) {
    ctx.answerCallbackQuery({ text: "Bu so'rov sizniki emas", show_alert: true });
    return null;
  }
  return v;
}

async function onVoiceYes(ctx) {
  const v = getVoiceDraft(ctx, ctx.match[1]);
  if (!v) return undefined;
  voiceDrafts.delete(ctx.match[1]);
  awaiting.delete(ctx.from.id);
  await ctx.answerCallbackQuery();
  return beginEntry(ctx, v.parsed);
}

async function onVoiceNo(ctx) {
  const v = getVoiceDraft(ctx, ctx.match[1]);
  if (!v) return undefined;
  voiceDrafts.delete(ctx.match[1]);
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  return respond(ctx, "❌ Bekor qilindi. Qayta ayting yoki matn bilan yozing.", null, { edit: true });
}

// ---------------------------------------------------------------
// Balans, hisobotlar, qarzlar
// ---------------------------------------------------------------

async function balance(ctx) {
  const accounts = await Account.list({ withBalances: true });
  const totals = {};
  for (const a of accounts) totals[a.currency] = (totals[a.currency] || 0) + a.balance;
  const { rates } = await Setting.getRates();
  const conv = Report.convertTotal(totals, rates);
  const extra = state.webAppUrl ? openAppKeyboard(state.webAppUrl) : undefined;
  return ctx.reply(renderBalances(accounts, conv), { ...HTML, ...(extra ? { reply_markup: extra } : {}) });
}

const PERIOD_TITLES = {
  today: "Bugungi hisobot",
  yesterday: "Kechagi hisobot",
  week: "Haftalik hisobot",
  month: "Oylik hisobot",
  year: "Yillik hisobot",
};

function reportKeyboard(active) {
  const kb = new InlineKeyboard();
  for (const [key, label] of [
    ["today", "Bugun"],
    ["yesterday", "Kecha"],
    ["week", "Hafta"],
    ["month", "Oy"],
    ["year", "Yil"],
  ]) {
    kb.text(key === active ? `• ${label} •` : label, `rp:${key}`);
  }
  kb.row().text("📥 Excel", `rx:${active}`);
  if (state.webAppUrl) kb.webApp("📱 Batafsil", state.webAppUrl);
  return kb;
}

async function showReport(ctx, period, { edit = false } = {}) {
  const report = await Report.buildReport(D.rangeForPeriod(period));
  return respond(ctx, renderReport(report, { title: PERIOD_TITLES[period] }), reportKeyboard(period), { edit });
}

async function reportCommand(ctx) {
  const arg = String(ctx.match || "").trim().toLowerCase();
  const map = { bugun: "today", kecha: "yesterday", hafta: "week", oy: "month", yil: "year" };
  return showReport(ctx, map[arg] || "today");
}

// /bugun: egasi va buxgalterga bugungi hisobot, xodimga o'zi kiritganlar
async function todayCommand(ctx) {
  if (isManager(ctx.user.role)) return showReport(ctx, "today");
  return myToday(ctx);
}

async function onReportPeriod(ctx) {
  const period = ctx.match[1];
  if (!PERIOD_TITLES[period]) return ctx.answerCallbackQuery();
  await ctx.answerCallbackQuery();
  return showReport(ctx, period, { edit: true });
}

async function onReportExport(ctx) {
  const period = ctx.match[1];
  if (!PERIOD_TITLES[period]) return ctx.answerCallbackQuery();
  await ctx.answerCallbackQuery({ text: "Excel tayyorlanmoqda..." });
  const range = D.rangeForPeriod(period);
  const settings = await Setting.publicSettings();
  const { buffer, filename, count } = await buildWorkbook({ range, businessName: settings.businessName });
  return ctx.replyWithDocument(new InputFile(buffer, filename), {
    caption: `📊 ${range.label} — ${count} ta operatsiya`,
  });
}

async function debts(ctx) {
  const summary = await Debt.summary();
  const extra = state.webAppUrl ? { reply_markup: openAppKeyboard(state.webAppUrl) } : {};
  return ctx.reply(renderDebtSummary(summary), { ...HTML, ...extra });
}

// Xodim uchun: bugun kiritganlari
async function myToday(ctx) {
  const today = D.startOfDay();
  const { items, totals } = await Transaction.list(
    { userId: ctx.user.id, from: today, to: D.addDays(today, 1) },
    { limit: 25 }
  );
  if (!items.length) return ctx.reply("📋 Bugun hali hech narsa kiritmadingiz.");

  const lines = ["📋 <b>Bugungi yozuvlarim</b>", ""];
  for (const t of items) {
    const label = t.category ? `${t.category.icon || ""} ${t.category.name}`.trim() : typeLabel(t.type);
    lines.push(
      `${D.formatTime(new Date(t.date))} · ${signedAmount(t.type, t.amount, t.currency)} — ${esc(label)}${t.note ? ` · ${esc(t.note)}` : ""}`
    );
  }
  lines.push("");
  for (const [cur, tot] of Object.entries(totals)) {
    lines.push(`<b>${cur}:</b> kirim ${formatMoney(tot.income, cur)}, chiqim ${formatMoney(tot.expense, cur)}`);
  }
  return ctx.reply(lines.join("\n"), HTML);
}

// ---------------------------------------------------------------
// Bot profili va xatoliklar
// ---------------------------------------------------------------

async function setupProfile(bot) {
  const attempt = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.error("Bot profilini sozlashda xatolik:", err.description || err.message);
    }
  };
  await attempt(() =>
    bot.api.setMyCommands([
      { command: "start", description: "Botni ishga tushirish" },
      { command: "kirim", description: "Kirim yozish" },
      { command: "chiqim", description: "Chiqim yozish" },
      { command: "balans", description: "Hisoblar qoldig'i" },
      { command: "hisobot", description: "Bugun / hafta / oy hisoboti" },
      { command: "qarzlar", description: "Qarzlar ro'yxati" },
      { command: "ilova", description: "Mini App'ni ochish" },
      { command: "yordam", description: "Yordam" },
    ])
  );
  await attempt(() => bot.api.setMyShortDescription("Biznesingiz kirim-chiqimi, qarzlari va hisobotlari — Telegram ichida."));
  await attempt(() =>
    bot.api.setMyDescription(
      "💼 Biznes uchun moliyaviy yordamchi\n\n• Kirim va chiqimlarni tez yozing\n• Hisoblar, qarzlar va hisobotlar\n• Excel yuklab olish\n\nBoshlash uchun /start ni bosing."
    )
  );
}

function onError(err) {
  const e = err.error || err;
  console.error("[bot] ushlanmagan xatolik:", e && e.description ? e.description : e && e.message ? e.message : e);
}

module.exports = {
  access,
  guard,
  requireManager,
  start,
  id,
  help,
  openApp,
  promptEntry,
  entryCommand,
  onText,
  onVoice,
  onVoiceYes,
  onVoiceNo,
  onOther,
  onUserDecision,
  onDraftType,
  onDraftCategory,
  onDraftAccount,
  onCancel,
  cancelCommand,
  onUndo,
  balance,
  reportCommand,
  todayCommand,
  onReportPeriod,
  onReportExport,
  debts,
  myToday,
  setupProfile,
  onError,
  LABELS,
};
