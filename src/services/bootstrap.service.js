// Ishga tushishda kerakli boshlang'ich ma'lumotlarni (toifalar, hisoblar, sozlamalar) tayyorlaydi
const config = require("../config/default");
const Category = require("../models/Category");
const Account = require("../models/Account");
const Setting = require("../models/Setting");
const User = require("../models/User");

// Egasi belgilanmaguncha "egasini aniqlash kodi" dastur qayta ishga tushganda ham o'zgarmasligi uchun bazada saqlanadi
async function ensureOwnerSetupCode() {
  if (await User.hasOwner()) return;
  let code = await Setting.get("owner_setup_code");
  if (!/^[A-Z0-9]{8}$/.test(code || "")) {
    code = config.ownerSetupCode;
    await Setting.set("owner_setup_code", code);
  }
  config.ownerSetupCode = code;
}

async function ensureSystemData() {
  await Category.ensureSystem();
  await Setting.ensureDefaults();

  // Oddiy toifa va hisoblar faqat birinchi marta qo'shiladi (keyin foydalanuvchi o'zgartiradi)
  if ((await Setting.get("defaults_seeded")) !== "true") {
    await Category.ensureDefaults();
    await Account.ensureDefaults();
    await Setting.set("defaults_seeded", "true");
  }

  await User.ensureOwnerFromEnv();
  await ensureOwnerSetupCode();
}

module.exports = { ensureSystemData };
