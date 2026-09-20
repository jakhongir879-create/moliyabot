# 💼 Moliya Bot — biznes uchun moliyaviy Telegram bot

Kirim-chiqim, hisoblar (naqd / karta / bank), qarzlar (nasiya), hisobotlar, xodimlar va Excel — hammasi o'zbek tilida.
Uch qism bir loyihada: **Bot + API** (Node.js), **Mini App** (Telegram ichidagi ilova) va **Admin Panel** (kompyuterdagi veb-sayt).

Hammasi **sizning kompyuteringizda (localhost)** ishlaydi. Hech qayerga joylash (deploy) shart emas.

---

## Imkoniyatlar

| Qism | Nima qiladi |
|---|---|
| **Bot** | `+500 ming savdo` yoki `-120 ming taksi` deb yozing — bot kirim/chiqimni yozadi. Balans, hisobot, qarzlar, Excel. Har kuni kechqurun kunlik hisobot, ertalab qarz eslatmasi. |
| **Mini App** | Bosh sahifa (balans, hisoblar, grafik), operatsiyalar, qarzlar, hisobotlar (grafiklar + Excel), profil. Egasi, buxgalter va xodim uchun turli ruxsatlar. |
| **Admin Panel** | Kompyuterda: boshqaruv paneli, operatsiyalar jadvali (filtr, qidiruv, tahrirlash), qarzlar, hisoblar, toifalar, hisobotlar, xodimlar, sozlamalar, faoliyat jurnali. |

**Rollar:** 👑 Egasi (hamma narsa) · 🧮 Buxgalter (moliya, xodimlarni boshqarmaydi) · 👷 Xodim (faqat kirim/chiqim yozadi, balansni ko'rmaydi).

---

## 1-QADAM. Neon bazasini yarating (bepul)

1. https://neon.tech saytiga kiring → **Sign up** (Google yoki email bilan).
2. **Create project** → nom: `moliya`, region: **Frankfurt** (Uzbekistonga eng yaqin) → **Create**.
3. Loyiha sahifasida **Connect** tugmasini bosing.
4. Oynada uzun `postgresql://...` manzil chiqadi → **Copy** bilan nusxalang.
   (Manzilda `-pooler` bo'lsa ham xavfsiz — dastur uni o'zi to'g'rilaydi.)

## 2-QADAM. Telegram bot oching (BotFather)

1. Telegram'da **@BotFather** ni toping (ismi yonida ko'k ✔ belgisi bor) va **Start** bosing.
2. `/newbot` yozing.
3. Bot **nomi**ni yozing (istalgan): `Moliya Bot`
4. Bot **username**ini yozing (oxiri `bot` bilan tugashi shart, band bo'lmasligi kerak): `mening_moliya_bot`
5. BotFather token beradi: `1234567890:AAExample...` → uni nusxalang.
   ⚠️ Tokenni hech kimga bermang.

## 3-QADAM. `.env` faylini to'ldiring

Loyiha papkasidagi **`.env`** faylini Notepad bilan oching va 3 ta qiymatni yozing (`=` dan keyin bo'sh joy va qo'shtirnoq qo'ymang):

```
BOT_TOKEN=1234567890:AAExample...
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
ADMIN_PASSWORD=o'zingiz-o'ylab-toping
```

`ADMIN_PASSWORD` — Admin Panelga kirish paroli (kamida 8 belgi). Faylni saqlang.

## 4-QADAM. Bazani tayyorlang (bir marta)

Loyiha papkasida terminal oching (papkada o'ng tugma → «Terminalda ochish») va:

```
npm run db:setup
```

Bu jadvallarni yaratadi va boshlang'ich toifalar hamda hisoblarni (Naqd pul, Plastik karta) yozadi.

## 5-QADAM. Ishga tushiring

```
npm start
```

(yoki `1-ishga-tushirish.bat` faylini ikki marta bosing.) Terminalda quyidagi chiqadi:

```
  Bot          : @mening_moliya_bot
  Admin Panel  : http://localhost:3000/admin
  ...
  👑 EGASI HALI BELGILANMAGAN
        /start K7M2QX9A
```

**Egasi bo'lish:** Telegram'da botingizga terminaldagi shu buyruqni (o'zingizniki bilan) yuboring: `/start K7M2QX9A`.
Shundan keyin siz botning egasisiz. Bot va Admin Panel tayyor.

**Admin Panel:** brauzerda http://localhost:3000/admin → 3-qadamdagi `ADMIN_PASSWORD` bilan kiring.

> Bot faqat `npm start` ishlab turgan paytda ishlaydi (kompyuter yoqilgan va terminal ochiq bo'lishi kerak). To'xtatish: `Ctrl + C`.

---

## 6-QADAM. Mini App uchun internet manzili (tunnel)

Telegram Mini App internet manzilini (https) talab qiladi. Kompyuteringizni internetga vaqtincha ulaydigan **tunnel** kerak. Dastur buni o'zi hal qiladi:

**A) Cloudflare tunnel — akkaunt shart emas (standart).** `tools/cloudflared.exe` (Cloudflare'ning rasmiy dasturi) loyiha ichida turibdi.
`npm start` ni ishga tushirsangiz, tunnel ham **o'zi ochiladi**. 10–20 soniyadan so'ng terminalda **«✅ Mini App manzili ulandi (cloudflared)»** chiqadi va bot menyusidagi **«📱 Ilova»** tugmasi shu manzilga ulanadi. Qo'shimcha hech narsa qilmaysiz.

Botingizni oching → yozish maydonining chap tomonidagi **«📱 Ilova»** tugmasini bosing.

- Manzil (`https://xxxx.trycloudflare.com`) dastur har safar qayta ishga tushganda o'zgaradi — bu normal, menyu tugmasi o'zi yangilanadi. Eski xabarlardagi «Ilovani ochish» tugmalari ishlamay qoladi, menyudagi tugmadan foydalaning.
- Boshqa kompyuterda `tools/cloudflared.exe` bo'lmasa: `winget install --id Cloudflare.cloudflared -e` (dastur uni o'zi topadi) yoki [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases) dan `cloudflared-windows-amd64.exe` ni yuklab, `tools` papkasiga `cloudflared.exe` nomi bilan qo'ying.
- Tunnelni o'chirish uchun `.env` ga `TUNNEL=off` yozing.

**B) ngrok (ixtiyoriy, akkaunt kerak).** ngrok ishlayotgan bo'lsa, dastur uni afzal ko'radi:
1. https://ngrok.com → bepul ro'yxatdan o'ting; `winget install --id Ngrok.Ngrok -e`, so'ng `ngrok update`.
2. Bir marta: `ngrok config add-authtoken SIZNING_TOKENINGIZ`
3. Yangi terminalda: `ngrok http 3000` (yoki `2-ngrok.bat`). Manzil 8 soniya ichida o'zi ulanadi.

ngrok birinchi ochishda «You are about to visit...» sahifasini ko'rsatishi mumkin — **Visit Site** ni bosing (bir marta). Cloudflare tunnelida bunday sahifa yo'q.

---

## Kundalik ishlatish

**Botda tez yozish** (summa + izoh):

| Yozing | Natija |
|---|---|
| `+500 ming savdo` | 500 000 so'm kirim |
| `-120 ming taksi` | 120 000 so'm chiqim |
| `-1.5 mln ijara` | 1 500 000 so'm chiqim |
| `+$100 xizmat` | 100 dollar kirim |
| `75 000 benzin` | avval kirim/chiqimligini so'raydi |

«ming» = 1 000, «mln» = 1 000 000. Bot toifani izohdan topadi yoki tugmalar bilan so'raydi. Xato yozilsa — **«↩️ Bekor qilish»** tugmasi bor.

**Buyruqlar:** `/kirim` `/chiqim` `/balans` `/hisobot` `/bugun` `/qarzlar` `/ilova` `/yordam`

**Xodim qo'shish:** xodim botga `/start` yuboradi → sizga «Yangi foydalanuvchi ruxsat so'radi» xabari keladi → **Xodim** yoki **Buxgalter** tugmasini bosing. (Mini App → Profil → Xodimlar yoki Admin Panel → Xodimlar orqali ham mumkin.)

**Qarzlar:** *Menga qarzdor* (mijoz sizga to'laydi) yoki *Men qarzdorman* (siz to'laysiz). To'lov yozilganda pul tanlangan hisobga avtomatik kirim/chiqim bo'ladi. Muddat kelganda bot eslatadi.

**Namuna ma'lumotlar:** grafiklar qanday ko'rinishini ko'rish uchun `npm run demo`, o'chirish uchun `npm run demo:clear`.

---

## Muammolar va yechimlar

| Muammo | Yechim |
|---|---|
| `BOT_TOKEN kiritilmagan` / `DATABASE_URL kiritilmagan` | `.env` faylini to'ldiring va `npm start` ni qayta ishga tushiring. |
| `Baza jadvallari topilmadi` | `npm run db:setup` ni ishga tushiring. |
| `Bazaga ulanib bo'lmadi` | Neon manzilini qayta nusxalang; internetni tekshiring. Neon bepul rejada baza «uxlab» qoladi — dastur o'zi bir necha marta urinadi. |
| `BOT_TOKEN noto'g'ri yoki bekor qilingan` | BotFather'dan tokenni qayta nusxalang (`/mybots` → botingiz → API Token). |
| `Bu bot boshqa joyda ham ishlayapti` | Ikkinchi terminal/kompyuterda ishlayotgan botni to'xtating. |
| `Moliya Bot allaqachon ishlayapti` | Bot boshqa oynada ishlab turibdi. O'sha oynani yoping (yoki Ctrl + C), so'ng qayta ishga tushiring. |
| `3000-port band` | Boshqa dastur shu portni ishlatyapti. `.env` da `PORT=3001` qiling. |
| Mini App «Ilova» tugmasi yo'q | ngrok ishlayotganini tekshiring, 10 soniya kuting; `/ilova` buyrug'ini yuboring. |
| Ilova «Sessiya eskirgan» deydi | Ilovani yopib, «📱 Ilova» tugmasi orqali qaytadan oching. |
| Windows Firewall so'rasa | «Bekor qilish»ni bosing — localhost uchun kerak emas. |
| `npm install` da «vulnerabilities» ogohlantirishi | Bu dasturlash vositalaridagi ma'lum ogohlantirishlar; bot ma'lumotlaringizga ta'sir qilmaydi. `npm audit fix --force` ni **bosmang**. |
| Mini App / Admin Panel o'zgargandan keyin yangilanmadi | `npm run build` ni ishga tushiring. |
| Tunnel ochilmayapti (manzil chiqmayapti) | 30 soniya kuting; bo'lmasa botni qayta ishga tushiring. Ba'zi tarmoqlar Cloudflare portini (7844) yopadi — u holda telefondan boshqa tarmoq (Wi-Fi/mobil internet) sinab ko'ring yoki ngrok (B variant) ishlating. |

---

## Loyiha tuzilmasi

```
├── src/                 Backend (Node.js)
│   ├── config/          Sozlamalar (.env)
│   ├── core/            Bot obyekti
│   ├── database/        Prisma ulanishi (Neon)
│   ├── models/          Baza logikasi (User, Account, Category, Transaction, Debt ...)
│   ├── controllers/     botController, clientController (Mini App API), adminController
│   ├── routes/          bot / client / admin yo'llari
│   ├── middlewares/     Telegram imzosi, admin JWT, ruxsatlar
│   ├── services/        Hisobot, Excel, xabarnoma, rejalashtiruvchi, ngrok
│   └── index.js         Ishga tushirish
├── prisma/              schema.prisma, migrations, seed.js, demo.js
├── mini-app/            Telegram Mini App (React)
├── admin-panel/         Admin Panel (React)
├── .env                 Sizning sozlamalaringiz (hech kimga bermang!)
└── package.json
```

## Xavfsizlik

- Mini App so'rovlari Telegram imzosi bilan tekshiriladi; ro'yxatdan o'tmagan odam ma'lumotni ko'ra olmaydi.
- Admin Panel **faqat shu kompyuterdan** (`localhost`) ochiladi — ngrok orqali kirib bo'lmaydi. Parol bilan himoyalangan.
- `.env` faylini, bot tokenini va Neon parolini hech kimga bermang.
- Barcha o'zgartirish va o'chirishlar Admin Panel → **Jurnal** bo'limida saqlanadi.

## Internetga joylash (kompyuterdan mustaqil ishlashi uchun)

Mini App va Admin Panel **Vercel**'da, bot va API **Render**'da ishlashi mumkin — kompyuter o'chiq bo'lsa ham.
Vercel qismi joylangan; Render uchun tayyor sozlama (`render.yaml`) va bosqichma-bosqich reja bor: **[DEPLOY.md](DEPLOY.md)**.

## Yangi versiyaga o'tish / qayta o'rnatish

Papkani boshqa kompyuterga ko'chirsangiz: `npm run install:all` (paketlar), `npm run build`, `.env` ni to'ldirish, `npm run db:setup`, `npm start`.
