// Mini App uchun internet manzili (tunnel).
//  1) ngrok ishlayotgan bo'lsa, manzilni undan oladi;
//  2) bo'lmasa tools/cloudflared.exe (yoki PATH'dagi cloudflared) ni o'zi ishga tushiradi (akkaunt kerak emas);
//  3) topilgan manzilni botning "📱 Ilova" tugmasiga ulaydi.
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const bot = require("../core/bot");
const state = require("../core/state");
const config = require("../config/default");

const POLL_MS = 8000;
const CLOUDFLARE_URL = /https:\/\/([a-z0-9-]+)\.trycloudflare\.com/gi;

let pollTimer = null;
let restartTimer = null;
let restartDelay = 4000;
let child = null;
let cloudflaredBin = null;
let stopped = false;

// ---------------------------------------------------------------
// ngrok
// ---------------------------------------------------------------
async function detectNgrokUrl() {
  for (const port of config.ngrokApiPorts) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/tunnels`, { signal: AbortSignal.timeout(1200) });
      if (!res.ok) continue;
      const json = await res.json();
      const tunnels = Array.isArray(json.tunnels) ? json.tunnels : [];
      const match = tunnels.find(
        (t) =>
          typeof t.public_url === "string" &&
          t.public_url.startsWith("https://") &&
          String((t.config && t.config.addr) || "").includes(String(config.port))
      );
      if (match) return match.public_url.replace(/\/+$/, "");
    } catch {
      // ngrok ishlamayapti — bu normal holat
    }
  }
  return "";
}

// ---------------------------------------------------------------
// Cloudflare (akkauntsiz "quick tunnel")
// ---------------------------------------------------------------
function findCloudflared() {
  const local = path.join(config.root, "tools", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
  if (fs.existsSync(local)) return local;
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["cloudflared"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return probe.status === 0 ? "cloudflared" : null;
}

// Jurnal matnidan tunnel manzilini topadi ("api.trycloudflare.com" xizmat manzili hisobga olinmaydi)
function parseCloudflareUrl(text) {
  for (const m of String(text).matchAll(CLOUDFLARE_URL)) {
    if (m[1].toLowerCase() !== "api") return `https://${m[1].toLowerCase()}.trycloudflare.com`;
  }
  return "";
}

function stopCloudflared() {
  clearTimeout(restartTimer);
  restartTimer = null;
  if (child) {
    child.intentional = true;
    try {
      child.kill();
    } catch {
      // allaqachon to'xtagan
    }
    child = null;
  }
}

function startCloudflared(log) {
  if (child || stopped || !cloudflaredBin) return;
  state.tunnelProvider = "cloudflared";
  state.tunnelStatus = "starting";
  log("🌐 Internet manzili (Cloudflare tunnel) ochilmoqda...");

  const proc = spawn(cloudflaredBin, ["tunnel", "--url", `http://localhost:${config.port}`, "--no-autoupdate"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child = proc;

  let buffer = "";
  let announced = "";
  const onData = (chunk) => {
    buffer = (buffer + chunk.toString()).slice(-4000);
    const url = parseCloudflareUrl(buffer);
    if (url && url !== announced) {
      announced = url;
      state.tunnelStatus = "up";
      restartDelay = 4000;
      applyUrl(url, "cloudflared", log);
    }
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);

  proc.on("error", (err) => {
    if (child === proc) child = null;
    state.tunnelStatus = "failed";
    log(`⚠️  Cloudflare tunnel'ni ishga tushirib bo'lmadi: ${err.message}`);
  });

  proc.on("exit", (code) => {
    if (child === proc) child = null;
    if (proc.intentional || stopped) return;
    state.tunnelStatus = "restarting";
    log(`⚠️  Tunnel uzildi (kod ${code}). ${Math.round(restartDelay / 1000)} soniyadan so'ng qayta ochiladi...`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startCloudflared(log);
    }, restartDelay);
    restartDelay = Math.min(restartDelay * 2, 60000);
  });
}

// ---------------------------------------------------------------
// Umumiy
// ---------------------------------------------------------------
async function applyUrl(url, source, log) {
  if (url === state.webAppUrl && source === state.webAppSource && state.menuButtonSet) return;
  state.webAppUrl = url;
  state.webAppSource = source;
  try {
    await bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "📱 Ilova", web_app: { url } },
    });
    state.menuButtonSet = true;
    log(`✅ Mini App manzili ulandi (${source}): ${url}`);
  } catch (err) {
    state.menuButtonSet = false;
    log(`⚠️  Bot menyusiga Mini App manzilini ulab bo'lmadi: ${err.description || err.message}`);
  }
}

async function tick(log) {
  const ngrokUrl = await detectNgrokUrl();
  if (ngrokUrl) {
    // ngrok ishlayapti — Cloudflare kerak emas
    stopCloudflared();
    state.tunnelProvider = "ngrok";
    state.tunnelStatus = "up";
    if (ngrokUrl !== state.webAppUrl) await applyUrl(ngrokUrl, "ngrok", log);
    return;
  }
  if (cloudflaredBin && !child && !restartTimer) startCloudflared(log);
}

// Ishga tushishda bot menyusiga qaysi manzil ulanishini tushuntiradi (banner uchun)
function describe() {
  if (config.webAppUrl) return config.webAppUrl;
  if (cloudflaredBin) return "Cloudflare tunnel ochilmoqda (10-20 soniya), manzil avtomatik ulanadi";
  return `ngrok kutilmoqda (yangi terminalda: ngrok http ${config.port})`;
}

function start(log = console.log) {
  stopped = false;
  if (config.webAppUrl) {
    applyUrl(config.webAppUrl, "env", log);
    return;
  }
  cloudflaredBin = config.tunnel === "off" ? null : findCloudflared();
  tick(log);
  pollTimer = setInterval(() => tick(log), POLL_MS);
  pollTimer.unref();
}

function stop() {
  stopped = true;
  if (pollTimer) clearInterval(pollTimer);
  stopCloudflared();
}

// Dastur kutilmagan holatda yopilsa ham tunnel jarayoni qolib ketmasin
process.on("exit", () => {
  if (child) {
    try {
      child.kill();
    } catch {
      // e'tiborsiz
    }
  }
});

module.exports = { start, stop, describe, detectNgrokUrl, parseCloudflareUrl };
