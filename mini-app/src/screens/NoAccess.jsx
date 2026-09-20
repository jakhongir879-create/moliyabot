import { RefreshCw } from "lucide-react";

const MESSAGES = {
  NO_INIT_DATA: {
    icon: "📱",
    title: "Ilovani Telegram'da oching",
    text: "Bu ilova faqat Telegram ichida ishlaydi. Botga kiring va pastdagi «Ilova» tugmasini bosing.",
  },
  BAD_INIT_DATA: {
    icon: "🔄",
    title: "Sessiya eskirgan",
    text: "Ilovani yopib, botdagi «Ilova» tugmasi orqali qaytadan oching.",
  },
  NOT_REGISTERED: {
    icon: "👋",
    title: "Ruxsat kerak",
    text: "Botga /start yuboring — egasiga ruxsat so'rovi ketadi. Tasdiqlangach ilovadan foydalana olasiz.",
  },
  PENDING: {
    icon: "⏳",
    title: "Tasdiqlash kutilmoqda",
    text: "So'rovingiz egasiga yuborilgan. Ruxsat berilgach, botda xabar keladi.",
  },
  BLOCKED: {
    icon: "🚫",
    title: "Ruxsat yo'q",
    text: "Sizga bu ilovadan foydalanishga ruxsat berilmagan.",
  },
  NO_BACKEND: {
    icon: "🔌",
    title: "Server ulanmagan",
    text: "Server hozir javob bermayapti: u uyg'onayotgan bo'lishi yoki backend manzili hali sozlanmagan bo'lishi mumkin. 1 daqiqadan so'ng qayta urinib ko'ring.",
  },
};

export default function NoAccess({ code, message }) {
  const m = MESSAGES[code] || { icon: "⚠️", title: "Xatolik", text: message || "Nimadir noto'g'ri ketdi." };
  return (
    <div className="no-access">
      <div className="no-icon">{m.icon}</div>
      <h1>{m.title}</h1>
      <p>{m.text}</p>
      {code !== "NO_INIT_DATA" ? (
        <button className="btn btn-soft" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Qayta tekshirish
        </button>
      ) : null}
    </div>
  );
}
