const TOKEN_KEY = "moliya_admin_token";

export const getToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* e'tiborsiz */
  }
};
export const clearToken = () => {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* e'tiborsiz */
  }
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Backend alohida joyda (masalan Render) bo'lsa, uning manzili qurish vaqtida VITE_API_URL orqali beriladi.
// Bo'sh bo'lsa, backend shu manzilning o'zida ishlaydi (kompyuterdagi rejim).
const API_BASE = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
export const isRemoteApi = Boolean(API_BASE);

export async function api(path, { method = "GET", body, params, blob = false } = {}) {
  const url = new URL(`${API_BASE}/api/admin${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${getToken() || ""}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      isRemoteApi
        ? "Server bilan aloqa yo'q. Backend (Render) ishlayotganini tekshiring; bepul tarifda u uxlab qolgan bo'lishi mumkin, 1 daqiqadan so'ng qayta urinib ko'ring."
        : "Server bilan aloqa yo'q. Dastur (npm start) ishlayotganini tekshiring.",
      0,
      "NETWORK"
    );
  }

  if (blob && res.ok) {
    const disposition = res.headers.get("content-disposition") || "";
    const match = /filename="?([^"]+)"?/.exec(disposition);
    return { blob: await res.blob(), filename: match ? match[1] : "moliya.xlsx" };
  }

  const data = await res.json().catch(() => null);
  if (res.status === 401 && data?.code === "ADMIN_AUTH") {
    clearToken();
    window.dispatchEvent(new Event("admin-logout"));
  }
  // JSON emas (HTML/bo'sh) javob: backend ulanmagan, uxlayapti yoki manzil noto'g'ri
  if (data === null) {
    throw new ApiError(
      "Server bilan bog'lanib bo'lmadi. Backend manzili (VITE_API_URL) sozlanmagan yoki server o'chiq/uyg'onmoqda.",
      res.status,
      "NO_BACKEND"
    );
  }
  if (!res.ok) throw new ApiError(data?.error || "Xatolik yuz berdi", res.status, data?.code);
  return data;
}

// Faylni brauzer orqali yuklab olish
export async function downloadFile(path, params) {
  const { blob, filename } = await api(path, { params, blob: true });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}
