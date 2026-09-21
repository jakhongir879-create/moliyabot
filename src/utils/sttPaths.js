// Ovozli xabarlar uchun kerakli fayllar (Vosk kutubxonasi va o'zbek tili modeli) joylashuvi.
// Ular repozitoriyga kirmaydi: "npm run voice:setup" buyrug'i models/ papkasiga yuklab oladi.
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const MODELS_DIR = path.join(ROOT, "models");

const MODEL = {
  name: "vosk-model-small-uz-0.22",
  url: "https://alphacephei.com/vosk/models/vosk-model-small-uz-0.22.zip",
};

const LIB_VERSION = "0.3.45";
const LIB_ARCHIVES = {
  "win32-x64": "vosk-win64",
  "linux-x64": "vosk-linux-x86_64",
};

const platformKey = () => `${process.platform}-${process.arch}`;

function libInfo() {
  const key = platformKey();
  const base = LIB_ARCHIVES[key];
  if (!base) return null;
  const folder = `${base}-${LIB_VERSION}`;
  return {
    key,
    url: `https://github.com/alphacep/vosk-api/releases/download/v${LIB_VERSION}/${folder}.zip`,
    archiveFolder: folder,
    dir: path.join(MODELS_DIR, `vosk-lib-${key}`),
    file: path.join(MODELS_DIR, `vosk-lib-${key}`, process.platform === "win32" ? "libvosk.dll" : "libvosk.so"),
  };
}

module.exports = {
  ROOT,
  MODELS_DIR,
  MODEL,
  modelDir: path.join(MODELS_DIR, MODEL.name),
  libInfo,
};
