// Pul summalarini hisoblash va chiroyli ko'rsatish
const config = require("../config/default");

const NBSP = " ";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Prisma Decimal / string / number -> oddiy son
const num = (v) => (v === null || v === undefined ? 0 : round2(Number(v)));

function groupDigits(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

// 1250000 -> "1 250 000", 1250.5 -> "1 250.5"
function formatNumber(value) {
  const n = round2(value);
  const [intPart, decPart] = Math.abs(n).toFixed(2).split(".");
  const dec = decPart.replace(/0+$/, "");
  return `${n < 0 ? "-" : ""}${groupDigits(intPart)}${dec ? `.${dec}` : ""}`;
}

// formatMoney(1250000, "UZS") -> "1 250 000 so'm", formatMoney(50, "USD") -> "$50"
function formatMoney(value, currency = "UZS", { sign = false } = {}) {
  const cur = config.currencies[currency] || { symbol: currency, position: "suffix" };
  const n = round2(value);
  const body = formatNumber(Math.abs(n));
  const prefix = n < 0 ? "-" : sign && n > 0 ? "+" : "";
  return cur.position === "prefix" ? `${prefix}${cur.symbol}${body}` : `${prefix}${body}${NBSP}${cur.symbol}`;
}

// { UZS: 5, USD: 10 } ko'rinishidagi obyektni "5 so'm + $10" matniga aylantiradi
function formatMulti(byCurrency, opts) {
  const entries = Object.entries(byCurrency || {}).filter(([, v]) => round2(v) !== 0);
  if (!entries.length) return formatMoney(0, config.baseCurrency);
  return entries.map(([cur, v]) => formatMoney(v, cur, opts)).join(" + ");
}

const isCurrency = (code) => Object.prototype.hasOwnProperty.call(config.currencies, code);

module.exports = { round2, num, formatNumber, formatMoney, formatMulti, isCurrency };
