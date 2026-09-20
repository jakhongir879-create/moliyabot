// Vercel uchun: Mini App va Admin Panelni quradi va bitta papkaga (vercel-dist) joylaydi.
//   /        -> Mini App
//   /admin/  -> Admin Panel
// Backend (Render) manzili VITE_API_URL o'zgaruvchisi bilan beriladi:
//   Vercel -> Settings -> Environment Variables -> VITE_API_URL
// Diqqat: bu skript mini-app/dist va admin-panel/dist papkalariga tegmaydi (ular kompyuterdagi server uchun).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "vercel-dist");

function run(command, cwd) {
  console.log(`\n$ [${path.basename(cwd)}] ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: process.env });
}

console.log(`Backend manzili (VITE_API_URL): ${process.env.VITE_API_URL || "— kiritilmagan —"}`);

fs.rmSync(out, { recursive: true, force: true });

const apps = [
  { name: "mini-app", outDir: "../vercel-dist" },
  { name: "admin-panel", outDir: "../vercel-dist/admin" },
];

for (const app of apps) {
  const cwd = path.join(root, app.name);
  run("npm install --include=dev --no-audit --no-fund", cwd);
  run(`npm run build -- --outDir ${app.outDir} --emptyOutDir`, cwd);
}

// Mavjud bo'lmagan manzillar uchun sahifa (vercel.json oxirgi qoidasi 404 holati bilan shuni beradi)
const notFoundPage = `<!doctype html>
<html lang="uz">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Sahifa topilmadi</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #111; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  p { margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #f3f4f6; } p { color: #9ca3af; } }
</style>
</head>
<body>
<main>
  <h1>Sahifa topilmadi</h1>
  <p>Bunday manzil mavjud emas.<br />Ilovani Telegram'dagi botning menyu tugmasi orqali oching.</p>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(out, "404.html"), notFoundPage);

console.log(`\n✅ Tayyor: ${out}`);
