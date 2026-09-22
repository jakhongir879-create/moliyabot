// Yandex SpeechKit orqali ovozni matnga aylantiradi (internetga ulanish talab qiladi, pullik xizmat).
// Sinxron tanish (https://stt.api.cloud.yandex.net/speech/v1/stt:recognize): eng ko'pi bilan 30 soniya, 1 MB.
// OGG/Opus formatini to'g'ridan-to'g'ri qabul qiladi — Telegram ovozli xabari qayta kodlanmasdan yuboriladi.
const ENDPOINT = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize";
const MAX_SECONDS = 30;

async function transcribeYandex(oggBuffer, { apiKey, folderId, lang }) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("folderId", folderId);
  url.searchParams.set("lang", lang);
  url.searchParams.set("format", "oggopus");

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Api-Key ${apiKey}` },
      body: oggBuffer,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(`Yandex SpeechKit bilan bog'lanib bo'lmadi: ${err.message}`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error_code) {
    throw new Error(data?.error_message || `Yandex SpeechKit xatosi (HTTP ${res.status})`);
  }
  return String(data.result || "").trim();
}

module.exports = { transcribeYandex, MAX_SECONDS };
