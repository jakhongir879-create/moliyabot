// Ovozli xabardan olingan matnni ("bugun besh yuz ming so'm savdo bo'ldi") kirim/chiqim yozuviga aylantiradi.
// Oldin sonlar raqamga o'giriladi, so'ng odatiy tezkor kiritish tahlilchisi (amountParser) ishlatiladi.
const { parseQuickEntry, isCurrencyWord } = require("./amountParser");
const { replaceNumberWords } = require("./uzbekNumbers");

// Kirim yoki chiqimligini bildiradigan so'zlar (faqat aniq belgilar; shubhali so'zlar qo'shilmagan).
// Ovoz modeli apostrofsiz yozadi ("toladi"), shuning uchun ikkala yozuv ham berilgan.
const INCOME_CUES = new Set(["kirim", "kirdi", "kirib", "daromad", "tushum", "tushdi", "savdo", "sotdim", "sotdik", "sotildi", "sotuv"]);
const EXPENSE_CUES = new Set([
  "chiqim", "chiqdi", "chiqib", "xarajat", "sarf", "sarfladim", "sarflandi", "ketdi", "sotib", "xarid", "harid",
  "to'ladim", "toladim", "to'ladi", "toladi", "to'ladik", "toladik", "to'landi", "tolandi",
]);

// Izohga kirmasligi kerak bo'lgan qo'shimcha so'zlar, fe'llar va "kirim"/"chiqim" belgilari
const NOISE = new Set([
  "bugun", "hozir", "hozirgina", "edi", "deb", "yozing", "yoz", "yozib", "iltimos", "menga",
  "bo'ldi", "boldi", "bo'lgan", "bolgan", "qo'ying", "qoying", "qo'y", "qoy",
  "kirdi", "kirib", "chiqdi", "chiqib", "tushdi", "ketdi", "sotildi", "sarflandi", "sarfladim", "sotdim", "sotdik", "oldi", "oldim", "olindi",
  "to'ladim", "toladim", "to'ladi", "toladi", "to'ladik", "toladik", "to'landi", "tolandi",
  "kirim", "chiqim",
]);

function inferType(tokens) {
  // "kirim" / "chiqim" deb aniq aytilgan bo'lsa, u hal qiluvchi
  const saidIncome = tokens.includes("kirim");
  const saidExpense = tokens.includes("chiqim");
  if (saidIncome !== saidExpense) return saidIncome ? "INCOME" : "EXPENSE";

  const income = tokens.some((t) => INCOME_CUES.has(t));
  const expense = tokens.some((t) => EXPENSE_CUES.has(t));
  if (income && !expense) return "INCOME";
  if (expense && !income) return "EXPENSE";
  return null;
}

// -> { text: tahlil qilingan matn, parsed: { type, amount, currency, note } | null }
function parseVoiceEntry(spoken, { defaultType = null } = {}) {
  const text = replaceNumberWords(spoken, isCurrencyWord);
  const tokens = text.split(" ").filter(Boolean);
  const inferred = inferType(tokens);

  const cleaned = tokens.filter((t) => !NOISE.has(t)).join(" ");
  const parsed = parseQuickEntry(cleaned, { defaultType });
  if (!parsed) return { text, parsed: null };

  if (!parsed.type) parsed.type = inferred;
  return { text, parsed };
}

module.exports = { parseVoiceEntry };
