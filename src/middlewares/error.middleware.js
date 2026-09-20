// Xatoliklarni qayta ishlash
const { HttpError } = require("../utils/httpError");
const { isTransient } = require("../database/connection");

function apiNotFound(_req, res) {
  res.status(404).json({ error: "Manzil topilmadi", code: "NOT_FOUND" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "So'rov formati noto'g'ri", code: "BAD_JSON" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "So'rov hajmi juda katta", code: "TOO_LARGE" });
  }
  if (err && err.code === "P2002") {
    return res.status(409).json({ error: "Bunday yozuv allaqachon mavjud", code: "DUPLICATE" });
  }
  if (err && err.code === "P2025") {
    return res.status(404).json({ error: "Yozuv topilmadi", code: "NOT_FOUND" });
  }
  if (err && err.code === "P2003") {
    return res.status(409).json({ error: "Bu yozuv boshqa ma'lumotlar bilan bog'langan", code: "IN_USE" });
  }
  if (isTransient(err)) {
    return res
      .status(503)
      .json({ error: "Baza bilan aloqa vaqtincha uzildi. Bir necha soniyadan so'ng qayta urinib ko'ring.", code: "DB_BUSY" });
  }

  console.error(`[xatolik] ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
  return res.status(500).json({ error: "Ichki xatolik yuz berdi. Qayta urinib ko'ring.", code: "SERVER_ERROR" });
}

module.exports = { apiNotFound, errorHandler };
