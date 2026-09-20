import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { haptic, setBackButton } from "../lib/telegram";

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

let nextSheetId = 1;

export function UIProvider({ children }) {
  const [sheets, setSheets] = useState([]);
  const [toastState, setToastState] = useState(null);
  const [dialog, setDialog] = useState(null);
  const toastTimer = useRef(null);

  const open = useCallback((name, props = {}) => {
    haptic("light");
    setSheets((list) => [...list, { id: nextSheetId++, name, props, closing: false }]);
  }, []);

  const close = useCallback((id) => {
    setSheets((list) => {
      let target = id;
      if (target === undefined) {
        const alive = list.filter((s) => !s.closing);
        target = alive.length ? alive[alive.length - 1].id : undefined;
      }
      return list.map((s) => (s.id === target ? { ...s, closing: true } : s));
    });
    setTimeout(() => setSheets((list) => list.filter((s) => !s.closing)), 220);
  }, []);

  const toast = useCallback((message, tone = "default") => {
    clearTimeout(toastTimer.current);
    setToastState({ message, tone, key: Date.now() });
    if (tone === "success") haptic("success");
    if (tone === "error") haptic("error");
    toastTimer.current = setTimeout(() => setToastState(null), 2800);
  }, []);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        haptic("warning");
        setDialog({ ...options, resolve });
      }),
    []
  );

  const answerDialog = useCallback((value) => {
    setDialog((d) => {
      d?.resolve(value);
      return null;
    });
  }, []);

  // Telegram "Orqaga" tugmasi: ochiq oyna bo'lsa yopadi
  const hasOpen = sheets.some((s) => !s.closing);
  useEffect(() => {
    setBackButton(hasOpen ? () => close() : null);
    document.body.classList.toggle("no-scroll", hasOpen);
  }, [hasOpen, close]);

  const value = useMemo(
    () => ({ sheets, open, close, toast, toastState, confirm, dialog, answerDialog }),
    [sheets, open, close, toast, toastState, confirm, dialog, answerDialog]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
