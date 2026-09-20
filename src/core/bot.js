// Telegram bot instansiyasini yaratish
const { Bot } = require("grammy");
const config = require("../config/default");

// Token index.js da tekshiriladi; bu yerda faqat obyekt yaratiladi
const bot = new Bot(config.botToken || "0:missing-token");

module.exports = bot;
