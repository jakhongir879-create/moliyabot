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

console.log(`\n✅ Tayyor: ${out}`);
