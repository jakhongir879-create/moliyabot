// Bot klaviaturalari
const { Keyboard, InlineKeyboard } = require("grammy");

const LABELS = {
  income: "➕ Kirim",
  expense: "➖ Chiqim",
  balance: "💰 Balans",
  report: "📊 Hisobot",
  debts: "🤝 Qarzlar",
  help: "ℹ️ Yordam",
  myToday: "📋 Bugungi yozuvlarim",
};

function mainKeyboard(role) {
  const kb = new Keyboard().text(LABELS.income).text(LABELS.expense).row();
  if (role === "STAFF") {
    kb.text(LABELS.myToday).text(LABELS.help);
  } else {
    kb.text(LABELS.balance).text(LABELS.report).row().text(LABELS.debts).text(LABELS.help);
  }
  return kb.resized().persistent();
}

const openAppKeyboard = (url) => new InlineKeyboard().webApp("📱 Ilovani ochish", url);

module.exports = { LABELS, mainKeyboard, openAppKeyboard };
