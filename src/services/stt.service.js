// Ovozli xabarni matnga aylantiradi. Hammasi serverning o'zida (oflayn) ishlaydi: Vosk + o'zbek tili modeli.
// Kerakli fayllar bo'lmasa ("npm run voice:setup" bilan yuklanadi), xizmat "o'chiq" turadi va bot faqat matn bilan ishlayveradi.
const fs = require("fs");
const path = require("path");
const config = require("../config/default");
const { modelDir, libInfo } = require("../utils/sttPaths");

const SAMPLE_RATE = 16000;
const CHUNK_BYTES = 16000; // 0.5 soniya (16 kHz, 16 bit)
const MODEL_IDLE_MS = 10 * 60 * 1000; // ishlatilmasa, xotirani bo'shatish uchun model o'chiriladi

let native = null;
let model = null;
let idleTimer = null;
let queue = Promise.resolve();

// ---------------------------------------------------------------
// Holat
// ---------------------------------------------------------------

function status() {
  if (!config.sttEnabled) return { ok: false, reason: "STT=off qilib o'chirilgan" };
  const lib = libInfo();
  if (!lib) return { ok: false, reason: `bu tizim (${process.platform}-${process.arch}) qo'llab-quvvatlanmaydi` };
  if (!fs.existsSync(lib.file) || !fs.existsSync(path.join(modelDir, "am"))) {
    return { ok: false, reason: "kerakli fayllar yuklanmagan (npm run voice:setup)" };
  }
  return { ok: true, reason: "" };
}

const isAvailable = () => status().ok;

// ---------------------------------------------------------------
// Vosk (koffi orqali)
// ---------------------------------------------------------------

function loadNative() {
  if (native) return native;
  const lib = libInfo();
  const koffi = require("koffi");

  // Windows: libvosk.dll yonidagi boshqa DLL fayllarni topishi uchun papkani PATH ga qo'shamiz
  if (process.platform === "win32") process.env.PATH = `${lib.dir}${path.delimiter}${process.env.PATH || ""}`;

  koffi.opaque("VoskModel");
  koffi.opaque("VoskRecognizer");
  const dll = koffi.load(lib.file);

  native = {
    setLogLevel: dll.func("void vosk_set_log_level(int log_level)"),
    modelNew: dll.func("VoskModel *vosk_model_new(const char *model_path)"),
    modelFree: dll.func("void vosk_model_free(VoskModel *model)"),
    recNew: dll.func("VoskRecognizer *vosk_recognizer_new(VoskModel *model, float sample_rate)"),
    recFree: dll.func("void vosk_recognizer_free(VoskRecognizer *recognizer)"),
    accept: dll.func("int vosk_recognizer_accept_waveform(VoskRecognizer *recognizer, const void *data, int length)"),
    result: dll.func("const char *vosk_recognizer_result(VoskRecognizer *recognizer)"),
    finalResult: dll.func("const char *vosk_recognizer_final_result(VoskRecognizer *recognizer)"),
  };
  native.setLogLevel(-1);
  return native;
}

function getModel() {
  const n = loadNative();
  if (!model) {
    model = n.modelNew(modelDir);
    if (!model) throw new Error("Ovoz modeli yuklanmadi");
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(releaseModel, MODEL_IDLE_MS);
  idleTimer.unref();
  return model;
}

function releaseModel() {
  if (model && native) native.modelFree(model);
  model = null;
}

const acceptAsync = (rec, chunk) =>
  new Promise((resolve, reject) => {
    // Alohida oqimda ishlaydi: server boshqa so'rovlarga javob berishda davom etadi
    native.accept.async(rec, chunk, chunk.length, (err, res) => (err ? reject(err) : resolve(res)));
  });

const textOf = (json) => {
  try {
    return String(JSON.parse(json || "{}").text || "").trim();
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------
// Ovozni dekodlash: Telegram ovozli xabari = OGG (Opus) -> 16 kHz, 16 bit PCM
// ---------------------------------------------------------------

function toPcm16(float32) {
  const out = Buffer.alloc(float32.length * 2);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), i * 2);
  }
  return out;
}

// Opus dekoderi 16 kHz'ni o'zi beradi; boshqa chastota chiqsa, oddiy usulda 16 kHz'ga keltiramiz
function resampleTo16k(samples, fromRate) {
  if (fromRate === SAMPLE_RATE) return samples;
  const ratio = fromRate / SAMPLE_RATE;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let k = start; k < end; k += 1) sum += samples[k];
    out[i] = sum / (end - start);
  }
  return out;
}

async function decodeToPcm(buffer) {
  const { OggOpusDecoder } = await import("ogg-opus-decoder");
  const decoder = new OggOpusDecoder({ sampleRate: SAMPLE_RATE });
  try {
    await decoder.ready;
    const { channelData, sampleRate } = await decoder.decodeFile(new Uint8Array(buffer));
    if (!channelData || !channelData.length || !channelData[0].length) return Buffer.alloc(0);

    // Stereo bo'lsa, o'rtachasini olamiz
    const mono = channelData.length === 1 ? channelData[0] : channelData[0].map((v, i) => (v + channelData[1][i]) / 2);
    return toPcm16(resampleTo16k(mono, sampleRate));
  } finally {
    decoder.free();
  }
}

// ---------------------------------------------------------------
// Asosiy funksiya
// ---------------------------------------------------------------

async function recognize(pcm) {
  const n = loadNative();
  const rec = n.recNew(getModel(), SAMPLE_RATE);
  try {
    const parts = [];
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
      const sentenceEnded = await acceptAsync(rec, pcm.subarray(offset, offset + CHUNK_BYTES));
      if (sentenceEnded) parts.push(textOf(n.result(rec)));
    }
    parts.push(textOf(n.finalResult(rec)));
    return parts.filter(Boolean).join(" ").trim();
  } finally {
    n.recFree(rec);
  }
}

// OGG (Opus) ovoz fayli -> matn. Bir vaqtda bitta ovoz tanilib, qolganlari navbat kutadi.
function transcribe(oggBuffer) {
  const job = queue.then(async () => {
    const pcm = await decodeToPcm(oggBuffer);
    if (!pcm.length) return "";
    return recognize(pcm);
  });
  queue = job.catch(() => undefined);
  return job;
}

module.exports = { status, isAvailable, transcribe, SAMPLE_RATE };
