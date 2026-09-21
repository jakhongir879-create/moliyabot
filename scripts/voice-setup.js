// Ovozli xabarlarni tushunish uchun kerakli fayllarni bir marta yuklab oladi (~66 MB):
//   1) Vosk kutubxonasi (GitHub: alphacep/vosk-api)
//   2) O'zbek tili ovoz modeli (alphacephei.com)
// Ishga tushirish: npm run voice:setup
const fs = require("fs");
const path = require("path");
const { once } = require("events");
const AdmZip = require("adm-zip");
const { MODELS_DIR, MODEL, modelDir, libInfo } = require("../src/utils/sttPaths");

async function download(url, file) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Yuklab bo'lmadi (HTTP ${res.status}): ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;

  const out = fs.createWriteStream(file);
  let received = 0;
  let lastStep = -1;
  for await (const chunk of res.body) {
    if (!out.write(chunk)) await once(out, "drain");
    received += chunk.length;
    const step = total ? Math.floor((received / total) * 10) : -1;
    if (step !== lastStep) {
      lastStep = step;
      if (total) console.log(`   ${step * 10}%`);
    }
  }
  out.end();
  await once(out, "finish");
  if (total && received !== total) throw new Error("Fayl to'liq yuklanmadi, qayta urinib ko'ring");
}

function extract(zipFile, destination) {
  new AdmZip(zipFile).extractAllTo(destination, true);
}

async function setupModel() {
  if (fs.existsSync(path.join(modelDir, "am"))) {
    console.log(`✅ Ovoz modeli bor: ${MODEL.name}`);
    return;
  }
  console.log(`⬇️  O'zbek tili ovoz modeli yuklanmoqda (51 MB)...`);
  const zip = path.join(MODELS_DIR, `${MODEL.name}.zip`);
  await download(MODEL.url, zip);
  extract(zip, MODELS_DIR);
  fs.rmSync(zip, { force: true });
  if (!fs.existsSync(path.join(modelDir, "am"))) throw new Error("Model to'g'ri ochilmadi");
  console.log(`✅ Ovoz modeli tayyor: ${modelDir}`);
}

async function setupLibrary() {
  const lib = libInfo();
  if (!lib) {
    console.log(`⚠️  Bu tizim (${process.platform}-${process.arch}) uchun Vosk kutubxonasi qo'llab-quvvatlanmaydi. Ovozli xabarlar o'chiq bo'ladi.`);
    return;
  }
  if (fs.existsSync(lib.file)) {
    console.log("✅ Vosk kutubxonasi bor");
    return;
  }
  console.log("⬇️  Vosk kutubxonasi yuklanmoqda...");
  const zip = path.join(MODELS_DIR, `${lib.archiveFolder}.zip`);
  await download(lib.url, zip);
  extract(zip, MODELS_DIR);
  fs.rmSync(zip, { force: true });
  fs.rmSync(lib.dir, { recursive: true, force: true });
  fs.renameSync(path.join(MODELS_DIR, lib.archiveFolder), lib.dir);
  if (!fs.existsSync(lib.file)) throw new Error("Vosk kutubxonasi to'g'ri ochilmadi");
  console.log(`✅ Vosk kutubxonasi tayyor: ${lib.dir}`);
}

(async () => {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  await setupLibrary();
  await setupModel();
  console.log("\n🎙  Ovozli xabarlar uchun hammasi tayyor. Botni qayta ishga tushiring.");
})().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
