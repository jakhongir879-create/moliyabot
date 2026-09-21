// So'z bilan aytilgan o'zbekcha sonlarni raqamga aylantiradi:
//   "besh yuz ming"                  -> 500000
//   "bir yarim million"              -> 1500000
//   "ikki yuz ellik ming so'm"       -> 250000 so'm
// Ovozli xabardan olingan matnni odatiy tezkor kiritish tahlilchisiga (amountParser) tayyorlash uchun ishlatiladi.

const UNITS = {
  nol: 0,
  bir: 1,
  ikki: 2,
  iki: 2,
  uch: 3,
  "to'rt": 4,
  tort: 4,
  besh: 5,
  olti: 6,
  yetti: 7,
  sakkiz: 8,
  "to'qqiz": 9,
  toqqiz: 9,
};

const TENS = {
  "o'n": 10,
  on: 10,
  yigirma: 20,
  "o'ttiz": 30,
  ottiz: 30,
  qirq: 40,
  ellik: 50,
  oltmish: 60,
  yetmish: 70,
  sakson: 80,
  "to'qson": 90,
  toqson: 90,
};

const BIG_SCALES = {
  ming: 1e3,
  million: 1e6,
  milyon: 1e6,
  mln: 1e6,
  milliard: 1e9,
  milyard: 1e9,
  mlrd: 1e9,
};

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "'", ь: "", ы: "i", э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
};

// Kichik harf, bir xil apostrof, lotin yozuvi, tinish belgilarsiz
function normalizeSpoken(text) {
  let s = String(text || "").toLowerCase();
  s = s.replace(/[‘’ʻʼ`´′]/g, "'");
  if (/[а-яёўқғҳ]/.test(s)) s = s.replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC[ch] ?? ch);
  return s
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// tokens[start] dan boshlab eng uzun to'g'ri son ketma-ketligini o'qiydi
function readNumber(tokens, start) {
  let total = 0;
  let current = 0;
  let lastKind = null; // unit | tens | yuz | scale
  let lastScale = Infinity;
  let hasScale = false;
  let consumed = 0;
  let validEnd = 0;
  let validValue = 0;
  let validHasScale = false;

  const commit = (i) => {
    validEnd = i + 1;
    validValue = total + current;
    validHasScale = hasScale;
  };

  for (let i = start; i < tokens.length; i += 1) {
    const w = tokens[i];

    if (w in UNITS) {
      // "yigirma besh" (tens + unit) mumkin, "besh besh" (unit + unit) emas
      if (lastKind === "unit") break;
      current += UNITS[w];
      lastKind = "unit";
    } else if (w in TENS) {
      if (lastKind === "unit" || lastKind === "tens") break;
      current += TENS[w];
      lastKind = "tens";
    } else if (w === "yuz") {
      if (lastKind === "unit" && current >= 1 && current <= 9) current *= 100;
      else if (lastKind === null || lastKind === "scale") current += 100;
      else break;
      lastKind = "yuz";
      hasScale = true;
    } else if (w === "yarim") {
      // "bir yarim million", "yarim million": yarim faqat katta birlikdan oldin keladi
      const next = tokens[i + 1];
      if (!(next in BIG_SCALES) || (lastKind !== null && lastKind !== "unit")) break;
      current += 0.5;
      lastKind = "half";
      continue;
    } else if (w in BIG_SCALES) {
      const scale = BIG_SCALES[w];
      if (scale >= lastScale) break;
      total += (current > 0 ? current : 1) * scale;
      current = 0;
      lastScale = scale;
      lastKind = "scale";
      hasScale = true;
    } else {
      break;
    }

    consumed += 1;
    commit(i);
  }

  if (!consumed) return null;
  return { value: validValue, end: validEnd, hasScale: validHasScale };
}

// Matndagi son so'zlarini raqamga almashtiradi. Faqat pul summasiga o'xshash ketma-ketliklar almashtiriladi:
// yuz/ming/million bor bo'lsa, yoki keyingi so'z valyuta bo'lsa ("yigirma besh dollar"). Shunda "bir kishi" kabi gaplar buzilmaydi.
function replaceNumberWords(text, isCurrencyWord = () => false) {
  const tokens = normalizeSpoken(text).split(" ").filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length; ) {
    const num = readNumber(tokens, i);
    if (num) {
      const next = tokens[num.end];
      // "500 ming" da "ming" — oldingi raqamning ko'paytiruvchisi, uni alohida son qilib bo'lmaydi
      const multiplierOfDigits = tokens[i] in BIG_SCALES && out.length > 0 && /^\d[\d.,]*$/.test(out[out.length - 1]);
      const moneyLike = num.hasScale || (next && isCurrencyWord(next));
      if (!multiplierOfDigits && moneyLike && Number.isFinite(num.value) && num.value > 0) {
        out.push(String(Math.round(num.value * 100) / 100));
        i = num.end;
        continue;
      }
    }
    out.push(tokens[i]);
    i += 1;
  }
  return out.join(" ");
}

module.exports = { normalizeSpoken, readNumber, replaceNumberWords };
