// Tezkor kiritish tahlilchisi.
// Misollar:
//   "+500 ming savdo"      -> kirim, 500 000 so'm, izoh: savdo
//   "-1.5 mln ijara"       -> chiqim, 1 500 000 so'm, izoh: ijara
//   "chiqim 50$ taksi"     -> chiqim, $50, izoh: taksi
//   "kirim 3 mln"          -> kirim, 3 000 000 so'm
//   "120 000 benzin"       -> tur noma'lum (null), 120 000 so'm, izoh: benzin

const INCOME_WORDS = new Set(["kirim", "daromad", "tushum", "kirdi", "income"]);
const EXPENSE_WORDS = new Set(["chiqim", "xarajat", "sarf", "chiqdi", "expense"]);

const MULTIPLIERS = {
  ming: 1e3,
  min: 1e3,
  mingta: 1e3,
  minglik: 1e3,
  k: 1e3,
  минг: 1e3,
  тыс: 1e3,
  mln: 1e6,
  million: 1e6,
  milyon: 1e6,
  млн: 1e6,
  mlrd: 1e9,
  milliard: 1e9,
  milyard: 1e9,
  млрд: 1e9,
};

const CURRENCY_WORDS = {
  UZS: ["so'm", "som", "sum", "sm", "uzs", "сум", "сўм", "so'mlik", "somlik"],
  USD: ["usd", "dollar", "dollor", "dolar", "dol", "доллар", "дол"],
  EUR: ["eur", "euro", "yevro", "evro", "евро"],
  RUB: ["rub", "rubl", "rubl'", "руб", "рубль"],
};
const CURRENCY_SYMBOLS = { $: "USD", "€": "EUR", "₽": "RUB" };

const WORD_TO_CURRENCY = {};
for (const [code, words] of Object.entries(CURRENCY_WORDS)) {
  for (const w of words) WORD_TO_CURRENCY[w] = code;
}

const TOKEN_RE = /^([$€₽])?(\d[\d.,]*)([\p{L}']*)([$€₽])?$/u;
const DATE_LIKE_RE = /^\d{1,4}[./]\d{1,2}[./]\d{2,4}$/;

function normalizeText(text) {
  return String(text || "")
    .replace(/[‘’ʻʼ`´′]/g, "'")
    .replace(/[−–—]/g, "-")
    .trim();
}

// "500.000" (minglik), "1,5" (o'nlik), "1.250.000" kabi yozuvlarni songa aylantiradi
function parseNumberString(raw, hasMultiplier) {
  let s = String(raw).replace(/\s+/g, "").replace(/[.,]+$/, "");
  if (!/^\d[\d.,]*$/.test(s)) return NaN;

  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;

  if (dots && commas) {
    const decimalSep = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    s = s.split(thousandSep).join("").replace(decimalSep, ".");
    return Number(s);
  }

  const sep = dots ? "." : commas ? "," : null;
  if (!sep) return Number(s);

  if (dots + commas > 1) return Number(s.split(sep).join(""));

  const [intPart, fracPart] = s.split(sep);
  if (!hasMultiplier && fracPart.length === 3 && intPart !== "0" && intPart.length <= 3) {
    return Number(intPart + fracPart);
  }
  return Number(`${intPart}.${fracPart}`);
}

function parseQuickEntry(text, { defaultType = null } = {}) {
  let src = normalizeText(text);
  if (!src) return null;

  // "/kirim@bot 500" -> "kirim 500"
  src = src.replace(/^\/(kirim|chiqim)(@\w+)?\s*/i, (_m, cmd) => `${cmd} `);

  const tokens = src.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  let type = defaultType;
  const first = tokens[0].toLowerCase();
  if (INCOME_WORDS.has(first)) {
    type = "INCOME";
    tokens.shift();
  } else if (EXPENSE_WORDS.has(first)) {
    type = "EXPENSE";
    tokens.shift();
  } else if (first.startsWith("+")) {
    type = "INCOME";
    tokens[0] = tokens[0].slice(1);
    if (!tokens[0]) tokens.shift();
  } else if (first.startsWith("-")) {
    type = "EXPENSE";
    tokens[0] = tokens[0].slice(1);
    if (!tokens[0]) tokens.shift();
  }

  const consumed = new Set();
  let amount = null;
  let currency = null;
  let extraNote = "";

  for (let i = 0; i < tokens.length; i += 1) {
    if (DATE_LIKE_RE.test(tokens[i])) continue;
    const m = TOKEN_RE.exec(tokens[i]);
    if (!m) continue;

    const [, preSym, numRaw, suffixRaw, postSym] = m;
    let numStr = numRaw;
    let last = i;

    // "500 000" / "1 500 000" — minglik guruhlar alohida so'z bo'lib kelsa
    let canMerge = /^\d{1,3}$/.test(numStr) && !suffixRaw && !postSym;
    while (canMerge && tokens[last + 1] && /^\d{3}$/.test(tokens[last + 1])) {
      numStr += tokens[last + 1];
      last += 1;
    }

    let mult = 1;
    let cur = preSym ? CURRENCY_SYMBOLS[preSym] : null;

    const suffix = suffixRaw.toLowerCase();
    if (suffix) {
      if (MULTIPLIERS[suffix]) mult = MULTIPLIERS[suffix];
      else if (WORD_TO_CURRENCY[suffix]) cur = WORD_TO_CURRENCY[suffix];
      else extraNote = suffixRaw; // masalan "500ta"
    }
    if (postSym) cur = CURRENCY_SYMBOLS[postSym];

    // Keyingi so'zlar: "ming", "mln", "so'm", "$"
    for (let step = 0; step < 2; step += 1) {
      const next = tokens[last + 1];
      if (!next) break;
      const w = next.toLowerCase();
      if (mult === 1 && MULTIPLIERS[w]) {
        mult = MULTIPLIERS[w];
        last += 1;
      } else if (!cur && WORD_TO_CURRENCY[w]) {
        cur = WORD_TO_CURRENCY[w];
        last += 1;
      } else if (!cur && CURRENCY_SYMBOLS[w]) {
        cur = CURRENCY_SYMBOLS[w];
        last += 1;
      } else {
        break;
      }
    }

    const value = parseNumberString(numStr, mult !== 1) * mult;
    if (!Number.isFinite(value) || value <= 0 || value > 1e13) {
      extraNote = "";
      continue;
    }

    amount = Math.round(value * 100) / 100;
    currency = cur;
    for (let k = i; k <= last; k += 1) consumed.add(k);
    break;
  }

  if (amount === null) return null;

  const note = [...tokens.filter((_, idx) => !consumed.has(idx)), extraNote]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

  return { type, amount, currency: currency || "UZS", note };
}

// Izoh matni ichida toifa nomi bo'lsa, o'sha toifani topadi
function matchCategoryByText(categories, text) {
  const haystack = normalizeText(text).toLowerCase();
  if (!haystack) return null;
  const clean = (s) =>
    normalizeText(s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}' ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const hay = ` ${clean(haystack)} `;
  let best = null;
  for (const c of categories) {
    // Toifa nomining birinchi so'zi (masalan "Ijara", "Transport", "Ish haqi" -> "ish haqi")
    const name = clean(c.name);
    const firstWord = name.split(" ")[0];
    const candidates = [name, firstWord].filter((w) => w && w.length >= 4);
    for (const cand of candidates) {
      if (hay.includes(` ${cand}`) || hay.includes(cand)) {
        if (!best || cand.length > best.len) best = { category: c, len: cand.length };
      }
    }
  }
  return best ? best.category : null;
}

module.exports = { parseQuickEntry, parseNumberString, matchCategoryByText };
