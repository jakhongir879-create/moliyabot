// Sana va vaqt yordamchilari. Barcha "bugun / hafta / oy" hisob-kitoblari Toshkent vaqti bo'yicha.
const config = require("../config/default");

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const OFFSET = config.tzOffsetHours * HOUR;

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];
const MONTHS_CAP = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

const pad = (n) => String(n).padStart(2, "0");

// Toshkent devor soatini UTC getter'lari bilan o'qish uchun siljitilgan sana
const shift = (d) => new Date(d.getTime() + OFFSET);

function parts(d) {
  const s = shift(d);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth(),
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    min: s.getUTCMinutes(),
    wd: s.getUTCDay(),
  };
}

function fromParts(y, m, d = 1, h = 0, min = 0) {
  return new Date(Date.UTC(y, m, d, h, min) - OFFSET);
}

const addDays = (d, n) => new Date(d.getTime() + n * DAY);

function startOfDay(d = new Date()) {
  const p = parts(d);
  return fromParts(p.y, p.m, p.d);
}

function startOfWeek(d = new Date()) {
  const p = parts(d);
  return addDays(startOfDay(d), -((p.wd + 6) % 7)); // dushanba
}

function startOfMonth(d = new Date(), monthOffset = 0) {
  const p = parts(d);
  return fromParts(p.y, p.m + monthOffset, 1);
}

function startOfYear(d = new Date(), yearOffset = 0) {
  const p = parts(d);
  return fromParts(p.y + yearOffset, 0, 1);
}

// "2026-09-20" -> Toshkent 00:00 (noto'g'ri bo'lsa null)
function parseYMD(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const date = fromParts(y, mo - 1, da);
  const p = parts(date);
  if (p.y !== y || p.m !== mo - 1 || p.d !== da) return null;
  return date;
}

function ymd(d) {
  const p = parts(d);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

// Foydalanuvchi kiritgan sanani (YYYY-MM-DD yoki ISO) aniq vaqtga aylantiradi.
// Bugungi sana bo'lsa - hozirgi vaqt, boshqa kun bo'lsa - kunning 12:00'i.
function resolveEntryDate(input, now = new Date()) {
  if (input === undefined || input === null || input === "") return now;
  let date;
  const str = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const day = parseYMD(str);
    if (!day) return null;
    const p = parts(day);
    date = ymd(day) === ymd(now) ? now : fromParts(p.y, p.m, p.d, 12, 0);
  } else {
    date = new Date(str);
    if (Number.isNaN(date.getTime())) return null;
  }
  if (date.getTime() > startOfDay(now).getTime() + 2 * DAY) return null; // kelajakdagi sana
  return date;
}

const formatDayMonth = (d) => {
  const p = parts(d);
  return `${p.d}-${MONTHS[p.m]}`;
};
const formatDate = (d) => {
  const p = parts(d);
  return `${p.d}-${MONTHS[p.m]} ${p.y}`;
};
const formatShortDate = (d) => {
  const p = parts(d);
  return `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`;
};
const formatTime = (d) => {
  const p = parts(d);
  return `${pad(p.h)}:${pad(p.min)}`;
};
const formatDateTime = (d) => `${formatShortDate(d)} ${formatTime(d)}`;
const weekdayName = (d) => WEEKDAYS[parts(d).wd];

// Muddatgacha necha kun qolgan (manfiy - o'tib ketgan)
function daysUntil(due, now = new Date()) {
  return Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
}

const PERIODS = ["today", "yesterday", "week", "month", "lastMonth", "year", "custom"];

function rangeForPeriod(period, query = {}, now = new Date()) {
  const today = startOfDay(now);
  const p = parts(now);
  let start;
  let end;
  let prevStart;
  let prevEnd;
  let label;
  let granularity = "day";

  switch (period) {
    case "today":
      start = today;
      end = addDays(today, 1);
      prevStart = addDays(today, -1);
      prevEnd = today;
      label = `Bugun, ${formatDayMonth(today)}`;
      granularity = "hour";
      break;
    case "yesterday":
      start = addDays(today, -1);
      end = today;
      prevStart = addDays(today, -2);
      prevEnd = start;
      label = `Kecha, ${formatDayMonth(start)}`;
      granularity = "hour";
      break;
    case "week":
      start = startOfWeek(now);
      end = addDays(start, 7);
      prevStart = addDays(start, -7);
      prevEnd = start;
      label = `${formatDayMonth(start)} – ${formatDayMonth(addDays(end, -1))}`;
      break;
    case "month":
      start = startOfMonth(now);
      end = startOfMonth(now, 1);
      prevStart = startOfMonth(now, -1);
      prevEnd = start;
      label = `${MONTHS_CAP[p.m]} ${p.y}`;
      break;
    case "lastMonth": {
      start = startOfMonth(now, -1);
      end = startOfMonth(now);
      prevStart = startOfMonth(now, -2);
      prevEnd = start;
      const sp = parts(start);
      label = `${MONTHS_CAP[sp.m]} ${sp.y}`;
      break;
    }
    case "year":
      start = startOfYear(now);
      end = startOfYear(now, 1);
      prevStart = startOfYear(now, -1);
      prevEnd = start;
      label = `${p.y}-yil`;
      granularity = "month";
      break;
    case "custom": {
      const f = parseYMD(query.from);
      const t = parseYMD(query.to);
      if (!f || !t || t < f) throw new RangeError("Sana oralig'i noto'g'ri");
      start = f;
      end = addDays(t, 1);
      const span = end.getTime() - start.getTime();
      if (span > 366 * 5 * DAY) throw new RangeError("Sana oralig'i juda katta (eng ko'pi 5 yil)");
      prevEnd = start;
      prevStart = new Date(start.getTime() - span);
      label = ymd(f) === ymd(t) ? formatDate(f) : `${formatDate(f)} – ${formatDate(t)}`;
      granularity = span / DAY > 92 ? "month" : "day";
      break;
    }
    default:
      throw new RangeError("Noto'g'ri davr");
  }

  // Davr hali tugamagan bo'lsa (masalan, oyning 20-kuni), o'tgan davrning faqat shu qismi bilan solishtiramiz
  const inProgress = now.getTime() < end.getTime() && now.getTime() >= start.getTime();
  if (inProgress) {
    const elapsed = now.getTime() - start.getTime();
    prevEnd = new Date(Math.min(prevEnd.getTime(), prevStart.getTime() + elapsed));
  }

  const compareLabel = inProgress
    ? {
        today: "kechagi shu vaqtga nisbatan",
        week: "o'tgan haftaning shu qismiga nisbatan",
        month: "o'tgan oyning shu qismiga nisbatan",
        year: "o'tgan yilning shu qismiga nisbatan",
      }[period] || "oldingi davrning shu qismiga nisbatan"
    : "oldingi davrga nisbatan";

  return { period, from: start, to: end, prevFrom: prevStart, prevTo: prevEnd, label, granularity, compareLabel };
}

function bucketKey(d, granularity) {
  const p = parts(d);
  if (granularity === "hour") return pad(p.h);
  if (granularity === "month") return `${p.y}-${pad(p.m + 1)}`;
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

function bucketLabel(key, granularity) {
  if (granularity === "hour") return `${key}:00`;
  if (granularity === "month") return MONTHS_CAP[Number(key.slice(5, 7)) - 1].slice(0, 3);
  return String(Number(key.slice(8, 10)));
}

// Diagramma uchun bo'sh (0 qiymatli) ustunlar ro'yxati
function buildBuckets(range, now = new Date()) {
  const keys = [];
  const g = range.granularity;
  const tomorrow = addDays(startOfDay(now), 1);
  const limit = new Date(Math.min(range.to.getTime(), tomorrow.getTime()));

  if (g === "hour") {
    const last = range.to.getTime() <= now.getTime() ? 23 : parts(now).h;
    for (let h = 0; h <= last; h += 1) keys.push(pad(h));
  } else if (g === "day") {
    for (let t = range.from; t < limit; t = addDays(t, 1)) keys.push(ymd(t));
  } else {
    const sp = parts(range.from);
    for (let i = 0; ; i += 1) {
      const t = fromParts(sp.y, sp.m + i, 1);
      if (t >= limit) break;
      keys.push(bucketKey(t, "month"));
    }
  }
  return keys;
}

module.exports = {
  DAY,
  HOUR,
  MONTHS,
  MONTHS_CAP,
  PERIODS,
  addDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  parseYMD,
  ymd,
  resolveEntryDate,
  formatDayMonth,
  formatDate,
  formatShortDate,
  formatTime,
  formatDateTime,
  weekdayName,
  daysUntil,
  rangeForPeriod,
  bucketKey,
  bucketLabel,
  buildBuckets,
};
