// Google Gemini orqali ovozni matnga aylantiradi (internetga ulanish talab qiladi; Google AI Studio'da
// bepul API-kalit olish mumkin, karta shart emas — Yandex'dan farqli). OGG/Opus'ni to'g'ridan-to'g'ri qabul qiladi.
const { GoogleGenAI } = require("@google/genai");

const PROMPT =
  "Ushbu ovozli xabarni so'zma-so'z, o'zbek tilida (lotin yozuvida) yozib ber. " +
  "Faqat eshitilgan gapning o'zini yoz — kirish so'zlari, izoh yoki tirnoq belgisi qo'shma. " +
  "Bu moliyaviy (pul) xabar: sonlarni va ularning o'lchov birligini (ming/million/milliard/so'm/dollar) " +
  "AYNAN eshitilganidek, birortasini ham tashlab ketmasdan yoz. Noaniq joy bo'lsa, eng yaqin eshitilgan " +
  "variantni yoz — hech qachon o'zingdan gap qo'shmagin yoki to'qimagin.";

let client = null;
let clientKey = null;

function getClient(apiKey) {
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    clientKey = apiKey;
  }
  return client;
}

async function transcribeGemini(oggBuffer, { apiKey, model }) {
  const ai = getClient(apiKey);
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ text: PROMPT }, { inlineData: { mimeType: "audio/ogg", data: oggBuffer.toString("base64") } }],
      config: { temperature: 0 },
    });
  } catch (err) {
    throw new Error(`Gemini bilan bog'lanib bo'lmadi: ${err.message}`);
  }
  return String(response.text || "").trim();
}

module.exports = { transcribeGemini };
