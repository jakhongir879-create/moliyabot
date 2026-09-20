// Express ilovasi: API + Mini App + Admin Panel statik fayllari
const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const { webhookCallback } = require("grammy");
const config = require("./config/default");
const clientRoutes = require("./routes/client.routes");
const adminRoutes = require("./routes/admin.routes");
const { localOnly } = require("./middlewares/auth.middleware");
const { apiNotFound, errorHandler } = require("./middlewares/error.middleware");

function notBuiltPage(name) {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} qurilmagan</title>
<style>body{font-family:system-ui,sans-serif;background:#fff;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
.c{max-width:460px}code{background:#f3f4f6;padding:2px 8px;border-radius:6px}</style></head>
<body><div class="c"><h2>${name} hali qurilmagan</h2>
<p>Terminalda loyiha papkasida quyidagi buyruqni ishga tushiring:</p>
<p><code>npm run install:all</code> so'ng <code>npm run build</code></p></div></body></html>`;
}

// Vite bilan qurilgan bir sahifali ilovani (SPA) xizmat qiladi
function serveSpa(dir, name) {
  const router = express.Router();
  const indexFile = path.join(dir, "index.html");

  router.use(
    express.static(dir, {
      index: false,
      setHeaders(res, filePath) {
        if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-store");
      },
    })
  );

  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (path.extname(req.path)) return next();
    if (!fs.existsSync(indexFile)) {
      // Render'da faqat API ishlaydi: Mini App va Admin Panel Vercel'da turadi
      if (config.apiOnly) {
        return res.json({
          ok: true,
          app: "moliya-bot",
          mode: "api",
          message: "Moliya Bot API ishlayapti. Mini App va Admin Panel alohida manzilda (Vercel) joylashgan.",
        });
      }
      return res.status(503).type("html").send(notBuiltPage(name));
    }
    res.setHeader("Cache-Control", "no-store");
    return res.sendFile(indexFile);
  });

  return router;
}

// Boshqa manzilda (Vercel) turgan Mini App / Admin Panelga API'dan foydalanishga ruxsat beradi
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // bir xil manzil yoki server-server so'rovi
    return callback(null, config.corsOrigins.includes(origin.replace(/\/+$/, "")));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 86400,
});

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // ngrok / Render / Cloudflare oldida bitta oraliq server bor

  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      hsts: false,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, app: "moliya-bot" }));

  // Webhook rejimi (Render): Telegram yangilanishlarni shu manzilga yuboradi; maxfiy kalit sarlavhada tekshiriladi
  if (config.botMode === "webhook") {
    const bot = require("./core/bot");
    app.post(
      config.webhookPath,
      webhookCallback(bot, "express", {
        secretToken: config.webhookSecret,
        timeoutMilliseconds: 9000,
        onTimeout: "return",
      })
    );
  }

  app.use("/api", corsMiddleware);
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.apiRateLimit,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Juda ko'p so'rov yuborildi. Biroz kuting.", code: "RATE_LIMIT" },
    })
  );
  app.use("/api/client", clientRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", apiNotFound);

  // Admin Panel faqat localhost orqali; Mini App hamma uchun (ngrok orqali ham)
  app.use("/admin", localOnly, serveSpa(config.paths.adminPanel, "Admin Panel"));
  app.use(serveSpa(config.paths.miniApp, "Mini App"));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
