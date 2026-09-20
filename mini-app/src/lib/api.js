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

export async function api(path, { method = "GET", body, params, signal } = {}) {
  const url = new URL(`/api/client${path}`, window.location.origin);
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
        "ngrok-skip-browser-warning": "1",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError("Internet bilan aloqa yo'q. Ulanishni tekshiring.", 0, "NETWORK");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error || "Xatolik yuz berdi. Qayta urinib ko'ring.", res.status, data?.code);
  return data;
}
