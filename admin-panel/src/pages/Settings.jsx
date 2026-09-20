import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, downloadFile } from "../api";
import { AmountField, Card, ErrorBox, Field, Spinner, Switch, cx, useUI } from "../ui";
import { fmtDateTime, fmtMoney, groupInput, parseInput } from "../format";

const hh = (n) => String(n).padStart(2, "0");
const SOURCE_LABEL = { ngrok: "ngrok", cloudflared: "Cloudflare tunnel", env: ".env" };

function SettingRow({ title, text, children }) {
  return (
    <div className="setting-row">
      <div>
        <b>{title}</b>
        {text ? <p className="muted small">{text}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const ui = useUI();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["settings"], queryFn: () => api("/settings") });
  const system = useQuery({ queryKey: ["system"], queryFn: () => api("/system"), refetchInterval: 10_000 });

  const [name, setName] = useState("");
  const [rates, setRates] = useState({ USD: "", EUR: "", RUB: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.businessName);
    setRates({ USD: data.rates.USD ? groupInput(String(data.rates.USD)) : "", EUR: data.rates.EUR ? groupInput(String(data.rates.EUR)) : "", RUB: data.rates.RUB ? groupInput(String(data.rates.RUB)) : "" });
  }, [data]);

  const save = async (patch, message = "Saqlandi") => {
    setBusy(true);
    try {
      const res = await api("/settings", { method: "PUT", body: patch });
      qc.invalidateQueries();
      ui.toast(res.warning || message, res.warning ? "error" : "success");
    } catch (err) {
      ui.toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;

  const sys = system.data;

  return (
    <div className="settings-grid">
      <Card title="Biznes">
        <Field label="Biznes nomi" hint="Hisobotlar va Excel fayllarda ko'rinadi">
          <div className="row-gap">
            <input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" disabled={busy || !name.trim() || name === data.businessName} onClick={() => save({ businessName: name.trim() })}>Saqlash</button>
          </div>
        </Field>
      </Card>

      <Card title="Bildirishnomalar (Telegram)">
        <SettingRow title="Xodim yozganda egasiga xabar" text="Xodim operatsiya kiritganda yoki o'chirganda egasiga bildirishnoma boradi.">
          <Switch checked={data.notifyOwnerOnStaffEntry} onChange={(v) => save({ notifyOwnerOnStaffEntry: v })} />
        </SettingRow>
        <SettingRow title="Kunlik hisobot" text={`Har kuni soat ${hh(sys?.schedule?.dailyReportHour ?? 21)}:00 da egasi va buxgalterga kun yakuni yuboriladi.`}>
          <Switch checked={data.dailyReportEnabled} onChange={(v) => save({ dailyReportEnabled: v })} />
        </SettingRow>
        <SettingRow title="Qarz eslatmalari" text={`Har kuni soat ${hh(sys?.schedule?.debtReminderHour ?? 9)}:00 da muddati o'tgan yoki ertaga tugaydigan qarzlar haqida eslatma.`}>
          <Switch checked={data.debtRemindersEnabled} onChange={(v) => save({ debtRemindersEnabled: v })} />
        </SettingRow>
      </Card>

      <Card title="Valyuta kurslari">
        <SettingRow title="Markaziy bank kursini avtomatik olish" text={data.ratesUpdatedAt ? `Oxirgi yangilanish: ${fmtDateTime(data.ratesUpdatedAt)}` : "Hali yuklanmagan"}>
          <Switch checked={data.rateAuto} onChange={(v) => save({ rateAuto: v }, v ? "Kurslar yangilandi" : "Avtomatik yangilash o'chirildi")} />
        </SettingRow>
        <div className="form-grid three">
          {["USD", "EUR", "RUB"].map((c) => (
            <Field key={c} label={`1 ${c} = ? so'm`}>
              <AmountField value={rates[c]} onChange={(v) => setRates((r) => ({ ...r, [c]: v }))} currency="UZS" />
            </Field>
          ))}
        </div>
        <div className="row-gap">
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => save({ rateAuto: false, rates: { USD: parseInput(rates.USD) || undefined, EUR: parseInput(rates.EUR) || undefined, RUB: parseInput(rates.RUB) || undefined } }, "Kurslar qo'lda saqlandi")}
          >
            Qo'lda saqlash
          </button>
          <span className="muted small">Qo'lda saqlansa, avtomatik yangilash o'chadi. Kurslar faqat umumiy balansni so'mga o'girish uchun.</span>
        </div>
      </Card>

      <Card title="Tizim holati">
        {sys ? (
          <div className="sys-list">
            <div className="sys-row"><i className={cx("dot", sys.bot.online ? "on" : "off")} /><span>Telegram bot</span><b>{sys.bot.online ? `@${sys.bot.username} — ishlayapti${sys.bot.mode ? ` (${sys.bot.mode})` : ""}` : `ulanmagan${sys.bot.error ? ` (${sys.bot.error})` : ""}`}</b></div>
            <div className="sys-row"><i className={cx("dot", sys.webApp.url ? "on" : "warn")} /><span>Mini App manzili</span><b className="break">{sys.webApp.url ? `${sys.webApp.url} (${SOURCE_LABEL[sys.webApp.source] || sys.webApp.source})` : "tunnel kutilmoqda"}</b></div>
            <div className="sys-row"><i className={cx("dot", sys.database.ok ? "on" : "off")} /><span>Baza</span><b>{sys.database.ok ? "ulangan" : "xato"}</b></div>
            <div className="sys-row"><i className="dot on" /><span>Ish vaqti</span><b>{Math.floor(sys.uptimeSeconds / 3600)} soat {Math.floor((sys.uptimeSeconds % 3600) / 60)} daqiqa</b></div>
            <div className="sys-row"><i className="dot on" /><span>Ma'lumotlar</span><b>{sys.counts.users} foydalanuvchi · {sys.counts.transactions} operatsiya</b></div>
            <div className="sys-row"><i className="dot on" /><span>Versiya / vaqt zonasi</span><b>v{sys.version} · {sys.timezone}</b></div>
            {!sys.webApp.url ? <p className="hint">Mini App manzili hali ulanmagan. Tunnel ochilishini 10-20 soniya kuting; ochilmasa README.md dagi «Mini App uchun internet manzili» bo'limiga qarang.</p> : null}
            {sys.webApp.url && sys.webApp.source !== "env" ? <p className="hint">Bepul tunnel manzili dastur har safar qayta ishga tushganda o'zgaradi. Bot menyusidagi «📱 Ilova» tugmasi doim yangi manzilga ulanadi; eski xabarlardagi tugmalar ishlamay qoladi.</p> : null}
          </div>
        ) : <Spinner />}
      </Card>

      <Card title="Ma'lumotlarni yuklab olish">
        <SettingRow title="Barcha operatsiyalar (Excel)" text="Boshidan hozirgacha barcha operatsiyalar, xulosa va ochiq qarzlar.">
          <button className="btn" onClick={async () => { try { await downloadFile("/export", { period: "all" }); ui.toast("Excel fayl yuklab olindi", "success"); } catch (err) { ui.toast(err.message, "error"); } }}>
            <Download size={16} /> Yuklab olish
          </button>
        </SettingRow>
        <p className="muted small">Ma'lumotlar Neon bazasida saqlanadi. Qo'shimcha nusxa uchun Excel eksportdan muntazam foydalaning.</p>
      </Card>
    </div>
  );
}
