// Ishlayotgan dastur haqida umumiy ma'lumot (bot, ngrok manzili va h.k.)
const state = {
  startedAt: new Date(),
  botUsername: "",
  botName: "",
  botOnline: false,
  botMode: "", // "polling" | "webhook"
  botError: "",
  webAppUrl: "",
  webAppSource: "", // "env" | "ngrok" | "cloudflared" | ""
  menuButtonSet: false,
  tunnelProvider: "", // "ngrok" | "cloudflared" | ""
  tunnelStatus: "", // "starting" | "up" | "restarting" | "failed" | ""
  databaseOk: false,
};

module.exports = state;
