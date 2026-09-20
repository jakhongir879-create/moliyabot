import { getInitData } from "./telegram";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Foydalanuvchi ilovani ishlata olmaydigan holatlar
export const AUTH_CODES = new Set(["NO_INIT_DATA", "BAD_INIT_DATA", "NOT_REGISTERED", "PENDING", "BLOCKED"]);

// Backend alohida joyda (masalan Render) bo'lsa, uning manzili qurish vaqtida VITE_API_URL orqali beriladi.
// Bo'sh bo'lsa, backend shu manzilning o'zida ishlaydi (kompyuterdagi rejim).
const API_BASE = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

export async function api(path, { method = "GET", body, params, signal } = {}) {
  const url = new URL(`${API_BASE}/api/client${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `tma ${getInitData()}`,
        // ngrok'ning ogohlantirish sahifasini o'tkazib yuborish (faqat backend shu manzilning o'zida bo'lsa)
        ...(API_BASE ? {} : { "ngrok-skip-browser-warning": "1" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError("Internet bilan aloqa yo'q. Ulanishni tekshiring.", 0, "NETWORK");
  }

  const data = await res.json().catch(() => null);
  // JSON emas (HTML/bo'sh) javob: backend ulanmagan, uxlayapti yoki manzil noto'g'ri
  // (Vercel'da backend bo'lmasa, /api/... so'rovi ham 200 bilan oddiy HTML qaytarishi mumkin)
  if (data === null) {
    throw new ApiError(
      "Server bilan bog'lanib bo'lmadi. Backend manzili sozlanmagan yoki server hozir uyg'onmoqda.",
      res.status,
      "NO_BACKEND"
    );
  }
  if (!res.ok) throw new ApiError(data?.error || "Xatolik yuz berdi. Qayta urinib ko'ring.", res.status, data?.code);
  return data;
}
