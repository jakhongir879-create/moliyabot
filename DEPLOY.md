# 🌐 Internetga joylash: Vercel (frontend) + Render (backend)

Shu qo'llanma bo'yicha loyiha kompyuteringizga bog'liq bo'lmay qoladi: kompyuter o'chiq bo'lsa ham bot va ilovalar ishlaydi.

## 1. Umumiy sxema

```
Telegram ──► bot menyusidagi «📱 Ilova» ──► VERCEL  (Mini App + Admin Panel: tayyor statik sayt)
                                              │  API so'rovlari (HTTPS)
Telegram ──► webhook ──────────────────────► RENDER  (Bot + API: Node.js)
                                              │
                                              ▼
                                            NEON    (PostgreSQL baza)
```

| Qism | Qayerda | Holat |
|---|---|---|
| Mini App | Vercel | ✅ Joylangan: https://moliyabot-taupe.vercel.app |
| Admin Panel | Vercel | ✅ Joylangan: https://moliyabot-taupe.vercel.app/admin/ |
| Bot + API | Render | ⏳ Quyidagi reja bo'yicha siz qo'lda joylaysiz |
| Baza | Neon | ✅ Ishlayapti (o'zgarmaydi, ma'lumotlar saqlanib qoladi) |

> Backend (Render) joylanmaguncha Vercel'dagi Mini App va Admin Panel ochiladi, lekin ma'lumot ko'rsatmaydi («Server ulanmagan» deydi). Bu normal.

## 2. Vercel — tayyor (bajarilgan ishlar)

- Vercel loyihasi: **moliyabot** (hisob: `joxa3`), GitHub repozitoriysiga ulangan. `main` ga har `git push` avtomatik yangi versiyani chiqaradi.
- Mini App `/` da, Admin Panel `/admin/` da turadi (bitta loyiha, bitta manzil). Sozlamalar: [vercel.json](vercel.json), qurilish: [scripts/vercel-build.js](scripts/vercel-build.js).
- **Faqat bitta narsa qoladi:** backend manzilini ulash (5-qadam, `VITE_API_URL`).
- Vercel Hobby tarifi rasman **shaxsiy/notijorat** foydalanish uchun. Biznes uchun ishlatsangiz, Pro tarifi ($20/oy) tavsiya etiladi.

## 3. Render — bosqichma-bosqich reja

### 0-qadam. Tayyorgarlik (5 daqiqa)

Quyidagilar qo'lingizda bo'lsin:

| Nima | Qayerdan |
|---|---|
| `BOT_TOKEN` | BotFather → `/mybots` → botingiz → API Token |
| `DATABASE_URL` | Neon → loyiha → **Connect** → connection string (hozirgi `.env` dagi bilan bir xil) |
| `ADMIN_PASSWORD` | O'zingiz o'ylab toping, **kamida 12 belgi** (katta/kichik harf, raqam, belgi aralash). Internetga ochiladigan panel uchun kuchli parol shart! |
| Vercel manzili | `https://moliyabot-taupe.vercel.app` |

**Muhim:** Render'ga o'tishdan oldin **kompyuterdagi botni to'xtating** (`1-ishga-tushirish.bat` oynasini yoping yoki Claude'dan «botni to'xtat» deng). Bir bot tokenini ikki joyda bir vaqtda ishlatib bo'lmaydi: kompyuter va Render bir-birini to'xtatib qo'yadi. Render ishlab turganda kompyuterda botni yoqmang.

### 1-qadam. Render akkaunti

1. https://render.com → **Get Started** → **GitHub bilan kirish** (eng oson).
2. Render GitHub'dagi repozitoriyingizni ko'rishi uchun ruxsat so'rasa, `jakhongir879-create/moliyabot` ni tanlab ruxsat bering.

### 2-qadam. Blueprint orqali yaratish (tavsiya etiladi)

Repozitoriyda tayyor [render.yaml](render.yaml) bor: hamma sozlama oldindan yozilgan.

1. Render Dashboard → **New +** → **Blueprint**.
2. Repozitoriyni tanlang: `jakhongir879-create/moliyabot` → **Connect**.
3. Render `render.yaml` ni o'qib, `moliyabot-api` xizmatini ko'rsatadi. Sizdan **3 ta maxfiy qiymat** so'raydi:
   - `BOT_TOKEN` → BotFather tokeni
   - `DATABASE_URL` → Neon manzili
   - `ADMIN_PASSWORD` → 12+ belgili parol
4. **Apply** / **Deploy Blueprint** ni bosing. Qurilish 3–6 daqiqa oladi.

> Blueprint chiqmasa yoki xato bersa, pastdagi «2-B. Qo'lda yaratish» ga o'ting.

### 2-B. Qo'lda yaratish (Blueprint ishlamasa)

**New +** → **Web Service** → repozitoriyni tanlang va quyidagilarni kiriting:

| Maydon | Qiymat |
|---|---|
| Name | `moliyabot-api` |
| Region | **Ohio (US East)** — Neon bazasi bilan bir joyda, eng tez |
| Branch | `main` |
| Root Directory | (bo'sh qoldiring) |
| Runtime | **Node** |
| Build Command | `npm ci && npx prisma generate && npm run db:migrate` |
| Start Command | `npm start` |
| Instance Type | **Free** (sinov) yoki **Starter** (doimiy, tavsiya) |
| Health Check Path | `/health` |

Keyin **Environment** bo'limiga quyidagi o'zgaruvchilarni qo'shing:

| Kalit | Qiymat |
|---|---|
| `NODE_VERSION` | `22` |
| `BOT_MODE` | `webhook` |
| `TUNNEL` | `off` |
| `ADMIN_REMOTE` | `true` |
| `API_RATE_LIMIT` | `1500` |
| `BUSINESS_NAME` | Biznesingiz nomi |
| `WEBAPP_URL` | `https://moliyabot-taupe.vercel.app` |
| `CORS_ORIGINS` | `https://moliyabot-taupe.vercel.app,https://moliyabot-joxa3.vercel.app` |
| `BOT_TOKEN` | BotFather tokeni |
| `DATABASE_URL` | Neon manzili |
| `ADMIN_PASSWORD` | 12+ belgili parol |

Oxirida **Create Web Service** ni bosing.

### 3-qadam. Joylanganini tekshirish

1. Render sahifasida xizmat holati **Live** bo'lishini kuting.
2. Sahifa tepasidagi manzilni oching, masalan `https://moliyabot-api.onrender.com/health` — `{"ok":true,"app":"moliya-bot"}` chiqishi kerak. **Bu manzilni yozib qo'ying** (5-qadamda kerak).
3. Render → **Logs** bo'limida quyidagilar bo'lishi kerak:
   - `MOLIYA BOT TAYYOR`
   - `✅ Webhook o'rnatildi: Telegram yangilanishlarni shu serverga yuboradi.`
   - `✅ Mini App manzili ulandi (env): https://moliyabot-taupe.vercel.app`
4. Telegram'da botga `/start` yuboring. Bot javob berishi kerak.

### 4-qadam. Egasi bo'lish (agar hali bo'lmagan bo'lsangiz)

Baza o'zgarmaganligi uchun avvalgi egasi va ma'lumotlar saqlanadi. Agar hali egasi bo'lmagan bo'lsangiz: Render Logs'da `EGASI HALI BELGILANMAGAN` va `/start KOD` ko'rinadi. O'sha buyruqni botga yuboring. Kod bazada saqlanadi, qayta ishga tushganda o'zgarmaydi.

### 5-qadam. Vercel'ga backend manzilini ulash

1. https://vercel.com → loyiha **moliyabot** → **Settings** → **Environment Variables**.
2. Yangi o'zgaruvchi qo'shing:
   - **Key:** `VITE_API_URL`
   - **Value:** Render manzili, **oxirida `/` siz**, masalan `https://moliyabot-api.onrender.com`
   - **Environments:** Production (va xohlasangiz Preview) belgilang.
3. **Save**.
4. **Deployments** → oxirgi deployment yonidagi **⋯** → **Redeploy** (keshni ishlatmasdan). O'zgaruvchi faqat yangi qurilishda ishga tushadi.
5. 1–2 daqiqadan so'ng Mini App va Admin Panel backend'ga ulanadi.

### 6-qadam. Telegram va Admin Panelda sinash

- Botni oching → menyudagi **«📱 Ilova»** → Mini App ochilib, ma'lumotlar ko'rinishi kerak.
- Admin Panel: https://moliyabot-taupe.vercel.app/admin/ → Render'dagi `ADMIN_PASSWORD` bilan kiring.
- Botga `+500 ming savdo` yozib, Mini App'da paydo bo'lishini tekshiring.

### 7-qadam. Bepul tarif uxlab qolmasligi uchun (faqat Free tarifda)

Render'ning bepul serveri 15 daqiqa so'rov bo'lmasa **uxlab qoladi**; uyg'onishi 30–60 soniya oladi (birinchi xabar/ochilish sekin bo'ladi, kunlik hisobot ham o'tib ketishi mumkin). Yechimlar:

- **Eng ishonchli:** Instance Type ni **Starter** (~$7/oy) ga o'tkazing — doim ishlaydi.
- **Bepul:** https://uptimerobot.com da bepul hisob oching → **Add New Monitor** → Monitor Type: **HTTP(s)** → URL: `https://moliyabot-api.onrender.com/health` → Interval: **5 minutes**. Shunda server uxlamaydi. (Render bepul rejasida oyiga 750 soat beradi: bitta xizmat uchun yetadi.)

## 4. Keyingi yangilanishlar

- Kodni o'zgartirib GitHub'ga yuborsangiz (`git push`), **Vercel** ham, **Render** ham (autoDeploy) o'zi yangilanadi.
- Bazaga yangi jadval/ustun qo'shilsa, Render qurilishida `npm run db:migrate` avtomatik bajariladi.
- Loglar: Render → **Logs**. Vercel → **Deployments** → deployment → **Logs**.
- Zaxira: Neon avtomatik nusxa saqlaydi; qo'shimcha Excel eksport: Admin Panel → **Sozlamalar** → «Yuklab olish».

## 5. Muammolar va yechimlar

| Alomat | Sabab / yechim |
|---|---|
| Mini App «Server ulanmagan» yoki Admin Panel «Server bilan bog'lanib bo'lmadi» | `VITE_API_URL` kiritilmagan yoki noto'g'ri (5-qadam), yoki Render uxlayapti (1 daqiqa kuting). O'zgaruvchidan keyin **Redeploy** qilish shart. |
| Brauzer konsolida `CORS` xatosi | Render'da `CORS_ORIGINS` ichida Vercel manzili yo'q yoki noto'g'ri yozilgan (`https://` bilan, oxirida `/` siz, vergul bilan ajrating). O'zgartirgach Render'da **Manual Deploy → Restart**. |
| Admin Panelda parol to'g'ri, lekin kirmaydi (404) | Render'da `ADMIN_REMOTE=true` emas. |
| Render Logs'da `ADMIN_PASSWORD kamida 12 belgi` | Parolni uzaytiring, so'ng qayta joylang. |
| Render Logs'da `PUBLIC_URL kerak` | Qo'lda yaratgan bo'lsangiz `PUBLIC_URL` = Render manzilini qo'shing (Blueprint'da bunday muammo bo'lmaydi). |
| Bot javob bermayapti | Render Logs'da «Webhook o'rnatildi» bormi? `BOT_TOKEN` to'g'rimi? Kompyuterda bot yoqilgan bo'lsa, o'chiring (409 to'qnashuv). |
| Render qurilishi `prisma` yoki `DATABASE_URL` xatosi | Build Command to'liq va aynan yuqoridagidek yozilganini, `DATABASE_URL` to'g'riligini tekshiring. |
| Birinchi ochilish juda sekin | Bepul tarif uyg'onmoqda (7-qadam). |
| Menyudagi «📱 Ilova» tugmasi eski (ngrok) manzilga olib boradi | Render ishga tushganda tugmani Vercel manziliga o'zi o'zgartiradi (`WEBAPP_URL`). Logs'da «Mini App manzili ulandi (env)» ni tekshiring. |

## 6. Xavfsizlik va cheklovlar

- **Admin Panel internetga ochiq bo'ladi.** Uni faqat kuchli parol (12+ belgi) himoya qiladi; kirish urinishlari cheklangan (15 daqiqada 10 ta), sessiya 12 soat. Parolni hech kimga bermang va boshqa joyda ishlatmang. Panelni umuman ishlatmasangiz, `ADMIN_REMOTE=false` qiling (panel ishlamay qoladi, bot va Mini App ishlayveradi).
- `BOT_TOKEN`, `DATABASE_URL`, `ADMIN_PASSWORD` faqat Render'ning **Environment** bo'limida turadi, GitHub'ga yozilmaydi.
- Mini App so'rovlari Telegram imzosi bilan tekshiriladi; ro'yxatdan o'tmagan odam ma'lumotni ko'ra olmaydi.
- Bepul tarif cheklovlari: Render Free — uxlab qoladi, 512 MB xotira, oyiga 750 soat. Vercel Hobby — notijorat foydalanish uchun.
- Ikki joyda bir vaqtda bot ishlatmang: Render ishlayotganda kompyuterdagi botni yoqmang. Sinov kerak bo'lsa, BotFather'da alohida test bot oching (`/newbot`).

## 7. Ovozli xabarlar

Ovozli xabarni matnga aylantirishning ikki usuli bor. Ikkalasi ham bir xil ishlaydi: bot eshitganini yozib, «✅ To'g'ri / ❌ Noto'g'ri» deb so'raydi — noto'g'ri tanilsa, hech narsa saqlanmaydi.

### 7.1. Bepul, oflayn (Vosk)

Kompyuterda: `npm run voice:setup` (bir marta, ~66 MB yuklaydi). Render'da: Build Command oxiriga ` && npm run voice:setup` qo'shing.

**Cheklov:** aniqligi past — sof, qisqa gapda («besh yuz ming so'm savdo») yaxshi ishlaydi, lekin uzun/tabiiy gapda ko'p xato qiladi (o'zbek tili uchun Vosk'da faqat shu «yengil» model bor, kattarog'i yo'q). Diqqat: ishlaganda ~200 MB xotira oladi, Render'ning bepul 512 MB xotirasi bilan tor keladi — xato/qayta ishga tushish ko'rinsa, `STT=off` qiling yoki 7.2-bo'limga o'ting.

### 7.2. Aniqroq, pullik (Yandex SpeechKit)

Ovoz Yandex serveriga yuboriladi va u yerda tanib olinadi — ancha aniqroq, lekin: (1) internetga ulanish shart, (2) Yandex Cloud'da hisob va to'lov kartasi kerak (foydalanish oz bo'lsa, oyiga narxi odatda juda past; ba'zan sinov krediti beriladi — aniq shartlarni ro'yxatdan o'tishda ko'rasiz), (3) ovoz uchinchi tomonga (Yandex, Rossiya) jo'natiladi.

**Sozlash:**
1. https://console.yandex.cloud ga kiring (Yandex ID yoki boshqa hisob bilan ro'yxatdan o'tish so'raladi).
2. Yangi **bo'lim (folder)** yarating (yoki tayyorini oching) — sahifa manzilida yoki bo'lim sozlamalarida ko'rinadigan **Folder ID** ni nusxalang.
3. **Xizmat hisoblari (Service accounts)** bo'limidan yangi xizmat hisobi yarating, unga `ai.speechkit-stt.user` (yoki shunga o'xshash SpeechKit) rolini bering.
4. O'sha xizmat hisobi ichida **API-kalit (API key)** yarating va nusxalang (faqat bir marta to'liq ko'rsatiladi — darrov saqlab qo'ying).
5. Render → **Environment** bo'limiga qo'shing: `STT_PROVIDER=yandex`, `YANDEX_STT_API_KEY=<nusxalangan kalit>`, `YANDEX_STT_FOLDER_ID=<Folder ID>`.
6. Kompyuterda ishlatmoqchi bo'lsangiz, xuddi shu 3 qatorni `.env` fayliga yozing.

Yandex konsoli ekranlari vaqt o'tishi bilan biroz o'zgarishi mumkin — biror qadamda tugmani topa olmasangiz, ekran rasmini yuboring, birga topamiz.
