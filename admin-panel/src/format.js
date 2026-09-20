export const CURRENCIES = {
  UZS: { code: "UZS", symbol: "so'm", position: "suffix", label: "So'm" },
  USD: { code: "USD", symbol: "$", position: "prefix", label: "Dollar" },
  EUR: { code: "EUR", symbol: "€", position: "prefix", label: "Yevro" },
  RUB: { code: "RUB", symbol: "₽", position: "suffix", label: "Rubl" },
};

const NBSP = " ";
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function fmtNumber(value) {
  const n = round2(value || 0);
  const [intPart, decPart] = Math.abs(n).toFixed(2).split(".");
  const dec = decPart.replace(/0+$/, "");
  return `${n < 0 ? "-" : ""}${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)}${dec ? `.${dec}` : ""}`;
}

export function fmtMoney(value, currency = "UZS", { sign = false } = {}) {
  const cur = CURRENCIES[currency] || { symbol: currency, position: "suffix" };
  const n = round2(value || 0);
  const body = fmtNumber(Math.abs(n));
  const prefix = n < 0 ? "−" : sign && n > 0 ? "+" : "";
  return cur.position === "prefix" ? `${prefix}${cur.symbol}${body}` : `${prefix}${body}${NBSP}${cur.symbol}`;
}

export function fmtCompact(value) {
  const n = Math.abs(value || 0);
  if (n >= 1e9) return `${round2(n / 1e9)} mlrd`;
  if (n >= 1e6) return `${round2(n / 1e6)} mln`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} ming`;
  return String(Math.round(n));
}

export function groupInput(raw) {
  const cleaned = String(raw).replace(/,/g, ".").replace(/[^\d.]/g, "");
  const [i, ...rest] = cleaned.split(".");
  const intPart = i.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return rest.length ? `${intPart || "0"}.${rest.join("").slice(0, 2)}` : intPart;
}

export const parseInput = (text) => {
  const n = Number(String(text || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const OFFSET = 5 * 3600 * 1000;
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const pad = (n) => String(n).padStart(2, "0");

export function parts(input) {
  const s = new Date(new Date(input).getTime() + OFFSET);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate(), h: s.getUTCHours(), min: s.getUTCMinutes() };
}

export const ymd = (input) => {
  const p = parts(input);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
};
export const todayYmd = () => ymd(new Date());

export function addDaysYmd(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const timeOf = (iso) => {
  const p = parts(iso);
  return `${pad(p.h)}:${pad(p.min)}`;
};

export const fmtShort = (iso) => {
  const p = parts(iso);
  return `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`;
};

export const fmtDateTime = (iso) => `${fmtShort(iso)} ${timeOf(iso)}`;

export function fmtDate(iso, { year = true } = {}) {
  const p = parts(iso);
  return `${p.d}-${MONTHS[p.m]}${year ? ` ${p.y}` : ""}`;
}

export function dueInfo(debt) {
  if (debt.status === "CLOSED") return { text: "Yopilgan", tone: "success" };
  if (debt.dueInDays === null || debt.dueInDays === undefined) return { text: "Muddatsiz", tone: "neutral" };
  if (debt.dueInDays < 0) return { text: `${Math.abs(debt.dueInDays)} kun kechikdi`, tone: "danger" };
  if (debt.dueInDays === 0) return { text: "Bugun", tone: "warn" };
  if (debt.dueInDays <= 3) return { text: `${debt.dueInDays} kun qoldi`, tone: "warn" };
  return { text: `${debt.dueInDays} kun qoldi`, tone: "neutral" };
}

export const TYPE_LABEL = { INCOME: "Kirim", EXPENSE: "Chiqim", TRANSFER: "O'tkazma" };
export const ROLE_LABEL = { OWNER: "Egasi", ACCOUNTANT: "Buxgalter", STAFF: "Xodim" };
export const ACCOUNT_TYPES = [
  { value: "CASH", label: "Naqd pul", icon: "💵" },
  { value: "CARD", label: "Karta", icon: "💳" },
  { value: "BANK", label: "Bank hisobi", icon: "🏦" },
  { value: "OTHER", label: "Boshqa", icon: "👛" },
];
export const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#e11d48", "#7c3aed", "#0891b2", "#db2777", "#64748b"];
export const EMOJI_CHOICES = [
  "🛒", "🧾", "📦", "💼", "🏠", "👥", "🚚", "📣", "💡", "🔧", "🍽️", "📱", "🏦", "🧰",
  "💰", "💳", "💵", "🎁", "🛠️", "⛽", "🚗", "🧴", "👕", "📚", "🎓", "🏥", "✈️", "🎯",
  "🧮", "🖨️", "💻", "📈", "🤝", "🪙", "🧹", "🧵", "🍞", "🥤", "🌐", "🏭",
];
