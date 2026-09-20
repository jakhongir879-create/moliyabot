import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useUI } from "../ui/UIContext";

export const useBootstrapQuery = () =>
  useQuery({ queryKey: ["bootstrap"], queryFn: () => api("/bootstrap"), staleTime: 60_000, retry: 1 });

export const useDashboard = () =>
  useQuery({ queryKey: ["dashboard"], queryFn: () => api("/dashboard"), refetchInterval: 45_000 });

// Amalni bajaradi: muvaffaqiyatda ma'lumotlarni yangilaydi va xabar ko'rsatadi, xatoda xato xabarini chiqaradi
export function useAction() {
  const qc = useQueryClient();
  const ui = useUI();
  return useCallback(
    async (fn, { success } = {}) => {
      try {
        const result = await fn();
        qc.invalidateQueries();
        if (success) ui.toast(success, "success");
        return result;
      } catch (err) {
        ui.toast(err.message || "Xatolik yuz berdi", "error");
        throw err;
      }
    },
    [qc, ui]
  );
}

// localStorage bilan xavfsiz ishlash (ba'zan ishlamasligi mumkin)
export function readStore(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* e'tiborsiz */
  }
}

export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => readStore(key, initial));
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        writeStore(key, v);
        return v;
      });
    },
    [key]
  );
  return [value, set];
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Ro'yxat oxiriga yetganda funksiyani chaqiradi (cheksiz yuklash)
export function useInfiniteSentinel(onReach, enabled) {
  const ref = useRef(null);
  const cb = useRef(onReach);
  cb.current = onReach;
  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    }, { rootMargin: "300px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
