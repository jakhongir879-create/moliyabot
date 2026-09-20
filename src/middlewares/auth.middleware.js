// Validatsiya va ruxsat tekshiruvlari
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config/default");
const User = require("../models/User");
const { unauthorized, forbidden, HttpError } = require("../utils/httpError");
const { permissionsFor } = require("../utils/permissions");

// ---------------------------------------------------------------
// Telegram Mini App: initData imzosini tekshirish
// ---------------------------------------------------------------

function verifyInitData(initData, { maxAgeSeconds = 24 * 60 * 60 } = {}) {
  if (!initData || typeof initData !== "string" || initData.length > 8192) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(config.botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest();
  const received = Buffer.from(hash, "hex");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSeconds) return null;

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
  if (!user || !user.id) return null;
  return { user, authDate };
}

function actorFromUser(user) {
  return {
    userId: user.id,
    telegramId: Number(user.telegramId),
    role: user.role,
    name: User.fullName(user),
    isAdmin: false,
  };
}

async function telegramAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  const initData = header.startsWith("tma ") ? header.slice(4).trim() : "";
  if (!initData) {
    throw unauthorized("Bu ilova faqat Telegram ichida ishlaydi. Botga kirib, «Ilova» tugmasini bosing.", "NO_INIT_DATA");
  }

  const parsed = verifyInitData(initData);
  if (!parsed) {
    throw unauthorized("Sessiya eskirgan yoki noto'g'ri. Ilovani yopib, qaytadan oching.", "BAD_INIT_DATA");
  }

  let user = await User.findByTelegramId(parsed.user.id);
  if (!user) throw forbidden("Sizga ruxsat berilmagan. Avval botga /start yuboring.", "NOT_REGISTERED");
  if (user.status === "PENDING") {
    throw forbidden("So'rovingiz egasi tomonidan hali tasdiqlanmagan. Biroz kuting.", "PENDING");
  }
  if (user.status === "BLOCKED") throw forbidden("Sizga ruxsat berilmagan.", "BLOCKED");

  user = await User.syncProfile(user, parsed.user);
  user = await User.touch(user);
  req.user = user;
  req.actor = actorFromUser(user);
  next();
}

const requirePermission = (permission) => (req, _res, next) => {
  if (!permissionsFor(req.actor.role)[permission]) {
    return next(forbidden("Bu amal uchun sizda ruxsat yo'q", "FORBIDDEN"));
  }
  return next();
};

// ---------------------------------------------------------------
// Admin Panel: parol + JWT, faqat shu kompyuterdan
// ---------------------------------------------------------------

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Tunnel (ngrok, Cloudflare va h.k.) orqali kelgan so'rovlarda bo'ladigan sarlavhalar
const PROXY_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "forwarded",
  "cf-connecting-ip",
  "cf-ray",
  "cdn-loop",
  "x-real-ip",
  "true-client-ip",
];

// Admin Panel faqat localhost orqali ochiladi. Tunnel (internet) orqali kelgan so'rovlar rad etiladi.
function localOnly(req, res, next) {
  const host = String(req.hostname || "").toLowerCase();
  const viaProxy = PROXY_HEADERS.some((h) => Boolean(req.get(h)));
  if (!LOCAL_HOSTS.has(host) || viaProxy) return res.status(404).type("text").send("Not found");
  return next();
}

const sha = (value) => crypto.createHash("sha256").update(String(value)).digest();

function passwordMatches(input) {
  if (!config.adminPassword) return false;
  return crypto.timingSafeEqual(sha(input), sha(config.adminPassword));
}

function signAdminToken() {
  return jwt.sign({ role: "admin" }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

let ownerCache = { at: 0, user: null };
async function resolveAdminActor() {
  if (Date.now() - ownerCache.at > 60 * 1000) {
    const owners = await User.owners();
    ownerCache = { at: Date.now(), user: owners[0] || null };
  }
  const owner = ownerCache.user;
  return {
    userId: owner ? owner.id : null,
    telegramId: owner ? Number(owner.telegramId) : null,
    role: "OWNER",
    name: "Admin Panel",
    isAdmin: true,
  };
}

async function adminAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== "admin") throw new Error("role");
  } catch {
    throw new HttpError(401, "Sessiya tugagan. Qaytadan kiring.", "ADMIN_AUTH");
  }
  req.actor = await resolveAdminActor();
  next();
}

module.exports = {
  verifyInitData,
  actorFromUser,
  telegramAuth,
  requirePermission,
  localOnly,
  passwordMatches,
  signAdminToken,
  adminAuth,
};
