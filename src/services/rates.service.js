// Valyuta kurslari (O'zbekiston Markaziy banki, cbu.uz)
const Setting = require("../models/Setting");

const CBU_URL = "https://cbu.uz/uz/arkhiv-kursov-valyut/json/";
const WANTED = ["USD", "EUR", "RUB"];

async function refreshRates({ force = false } = {}) {
  if (!force && !(await Setting.getBool("rate_auto"))) return null;

  const res = await fetch(CBU_URL, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`CBU javobi: ${res.status}`);
  const data = await res.json();

  const rates = {};
  for (const item of data) {
    if (!WANTED.includes(item.Ccy)) continue;
    const rate = Number(item.Rate) / Number(item.Nominal || 1);
    if (Number.isFinite(rate) && rate > 0) rates[item.Ccy] = Math.round(rate * 100) / 100;
  }
  if (!Object.keys(rates).length) throw new Error("Kurslar topilmadi");

  await Setting.setMany({ rates: JSON.stringify(rates), rates_updated_at: new Date().toISOString() });
  return rates;
}

// Qo'lda kiritilgan kurslarni saqlaydi va avtomatik yangilashni o'chiradi
async function setManualRates(input) {
  const rates = {};
  for (const code of WANTED) {
    const v = Number(input[code]);
    if (Number.isFinite(v) && v > 0) rates[code] = Math.round(v * 100) / 100;
  }
  await Setting.setMany({
    rates: JSON.stringify(rates),
    rates_updated_at: new Date().toISOString(),
    rate_auto: false,
  });
  return rates;
}

module.exports = { refreshRates, setManualRates };
