// Telegram Mini App bilan ishlash yordamchilari
const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

// Telegram skripti yuklanmasa ham, manzil hash'idan initData ni olishga urinamiz
export function getInitData() {
  if (tg?.initData) return tg.initData;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    return new URLSearchParams(hash).get("tgWebAppData") || "";
  } catch {
    return "";
  }
}

export const hasTelegram = () => Boolean(getInitData());

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#ffffff");
    tg.setBackgroundColor?.("#ffffff");
    tg.setBottomBarColor?.("#ffffff");
    tg.disableVerticalSwipes?.();
  } catch {
    /* eski versiyalarda ba'zi metodlar yo'q */
  }
}

export const tgUser = () => tg?.initDataUnsafe?.user || null;

export function haptic(kind = "light") {
  try {
    const h = tg?.HapticFeedback;
    if (!h) return;
    if (kind === "success" || kind === "error" || kind === "warning") h.notificationOccurred(kind);
    else if (kind === "select") h.selectionChanged();
    else h.impactOccurred(kind);
  } catch {
    /* e'tiborsiz */
  }
}

let backHandler = null;
export function setBackButton(handler) {
  const bb = tg?.BackButton;
  if (!bb) return;
  try {
    if (backHandler) bb.offClick(backHandler);
    backHandler = handler || null;
    if (handler) {
      bb.onClick(handler);
      bb.show();
    } else {
      bb.hide();
    }
  } catch {
    /* e'tiborsiz */
  }
}

export function openLink(url) {
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

export const closeApp = () => tg?.close?.();
