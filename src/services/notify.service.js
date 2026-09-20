// Foydalanuvchilarga bot orqali xabar yuborish
const bot = require("../core/bot");
const User = require("../models/User");
const Setting = require("../models/Setting");
const { esc } = require("../utils/html");
const { formatMoney } = require("../utils/money");
const { formatDateTime } = require("../utils/date");
const { mainKeyboard } = require("../utils/keyboards");

async function send(telegramId, text, extra = {}) {
  try {
    await bot.api.sendMessage(Number(telegramId), text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...extra,
    });
    return true;
  } catch (err) {
    console.error(`Xabar yuborib bo'lmadi (${telegramId}): ${err.description || err.message}`);
    return false;
  }
}

const toUser = (user, text, extra) => send(user.telegramId, text, extra);

async function toOwners(text, extra) {
  const owners = await User.owners();
  await Promise.all(owners.map((o) => toUser(o, text, extra)));
}

async function toManagers(text, extra, filter = () => true) {
  const managers = (await User.managers()).filter(filter);
  await Promise.all(managers.map((m) => toUser(m, text, extra)));
}

// Operatsiya haqida qisqa "chek" matni
function receiptText(tx, { title } = {}) {
  const heading =
    title || (tx.type === "INCOME" ? "Kirim yozildi" : tx.type === "EXPENSE" ? "Chiqim yozildi" : "O'tkazma bajarildi");
  const amount =
    tx.type === "TRANSFER"
      ? formatMoney(tx.amount, tx.currency)
      : formatMoney(tx.type === "EXPENSE" ? -tx.amount : tx.amount, tx.currency, { sign: true });

  const lines = [`✅ <b>${esc(heading)}</b>`, `${tx.type === "TRANSFER" ? "🔁" : "💵"} <b>${amount}</b>`];
  if (tx.type === "TRANSFER") {
    const to = tx.toAccount ? `${tx.toAccount.icon || ""} ${tx.toAccount.name}`.trim() : "";
    lines.push(`🏦 ${esc(tx.account.name)} → ${esc(to)}`);
    if (tx.toAmount !== null && tx.toAccount && tx.toAccount.currency !== tx.currency) {
      lines.push(`📥 Qabul qilindi: ${formatMoney(tx.toAmount, tx.toAccount.currency)}`);
    }
  } else {
    if (tx.category) lines.push(`📂 ${esc(`${tx.category.icon || ""} ${tx.category.name}`.trim())}`);
    lines.push(`🏦 ${esc(`${tx.account.icon || ""} ${tx.account.name}`.trim())}`);
  }
  if (tx.note) lines.push(`📝 ${esc(tx.note)}`);
  lines.push(`🕒 ${formatDateTime(new Date(tx.date))}`);
  return lines.join("\n");
}

// Operatsiya kiritilgach: (1) kiritganga chek, (2) xodim kiritgan bo'lsa egasiga xabar
async function transactionCreated({ user, tx, viaBot = false }) {
  try {
    if (user.sendReceipts && !viaBot) {
      await toUser(user, receiptText(tx), { disable_notification: true });
    }
    if (user.role === "STAFF" && (await Setting.getBool("notify_owner_staff_entry"))) {
      const who = esc(User.fullName(user));
      await toOwners(`🔔 <b>Xodim: ${who}</b>\n${receiptText(tx, { title: "Yangi operatsiya" }).split("\n").slice(1).join("\n")}`, {
        disable_notification: true,
      });
    }
  } catch (err) {
    console.error("Xabarnoma xatosi:", err.message);
  }
}

// Egasi foydalanuvchiga ruxsat bergach
async function userApproved(user) {
  const role = user.role === "ACCOUNTANT" ? "buxgalter" : "xodim";
  await toUser(
    user,
    `✅ <b>Ruxsat berildi!</b>\n\nSiz endi ${role} sifatida botdan foydalanishingiz mumkin.\nBoshlash uchun pastdagi tugmalardan foydalaning yoki /yordam ni bosing.`,
    { reply_markup: mainKeyboard(user.role) }
  );
}

module.exports = { send, toUser, toOwners, toManagers, receiptText, transactionCreated, userApproved };
