import { useState } from "react";
import Sheet from "../ui/Sheet";
import { Chip, Field, cx } from "../ui/common";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { CURRENCIES, addDaysYmd, fmtDate, fmtMoney, todayYmd } from "../lib/format";

// ---------------------------------------------------------------
// Sana oralig'ini tanlash
// ---------------------------------------------------------------
export function RangeSheet({ sheetId, closing, from, to, onApply }) {
  const ui = useUI();
  const [f, setF] = useState(from || addDaysYmd(todayYmd(), -6));
  const [t, setT] = useState(to || todayYmd());
  const valid = f && t && f <= t;

  const presets = [
    ["So'nggi 7 kun", addDaysYmd(todayYmd(), -6), todayYmd()],
    ["So'nggi 30 kun", addDaysYmd(todayYmd(), -29), todayYmd()],
    ["So'nggi 90 kun", addDaysYmd(todayYmd(), -89), todayYmd()],
  ];

  return (
    <Sheet
      title="Sana oralig'i"
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <button
          className="btn btn-primary btn-block btn-lg"
          disabled={!valid}
          onClick={() => {
            onApply(f, t);
            ui.close(sheetId);
          }}
        >
          Qo'llash
        </button>
      }
    >
      <div className="chip-scroll">
        {presets.map(([label, pf, pt]) => (
          <Chip key={label} active={f === pf && t === pt} onClick={() => { setF(pf); setT(pt); }}>{label}</Chip>
        ))}
      </div>
      <div className="two-col">
        <Field label="Boshlanishi">
          <input type="date" className="input" value={f} max={t || todayYmd()} onChange={(e) => e.target.value && setF(e.target.value)} />
        </Field>
        <Field label="Tugashi">
          <input type="date" className="input" value={t} min={f} max={todayYmd()} onChange={(e) => e.target.value && setT(e.target.value)} />
        </Field>
      </div>
      {!valid ? <div className="field-error">Boshlanish sanasi tugash sanasidan oldin bo'lishi kerak</div> : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Operatsiyalar filtri (hisob va toifa)
// ---------------------------------------------------------------
export function TxFiltersSheet({ sheetId, closing, accountId, categoryId, type, onApply }) {
  const { accounts, categories } = useApp();
  const ui = useUI();
  const [acc, setAcc] = useState(accountId || null);
  const [cat, setCat] = useState(categoryId || null);
  const cats = categories.filter((c) => (type ? c.type === type : true));

  return (
    <Sheet
      title="Filtr"
      closing={closing}
      onClose={() => ui.close(sheetId)}
      tall
      footer={
        <div className="foot-actions">
          <button className="btn btn-soft" onClick={() => { onApply(null, null); ui.close(sheetId); }}>Tozalash</button>
          <button className="btn btn-primary btn-grow btn-lg" onClick={() => { onApply(acc, cat); ui.close(sheetId); }}>Qo'llash</button>
        </div>
      }
    >
      <Field label="Hisob">
        <div className="chip-wrap">
          <Chip active={!acc} onClick={() => setAcc(null)}>Hammasi</Chip>
          {accounts.map((a) => (
            <Chip key={a.id} active={acc === a.id} onClick={() => setAcc(a.id)}>{a.icon} {a.name}</Chip>
          ))}
        </div>
      </Field>
      <Field label="Toifa">
        <div className="chip-wrap">
          <Chip active={!cat} onClick={() => setCat(null)}>Hammasi</Chip>
          {cats.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.icon} {c.name}</Chip>
          ))}
        </div>
      </Field>
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Valyuta kurslari
// ---------------------------------------------------------------
export function RatesSheet({ sheetId, closing }) {
  const { rates } = useApp();
  const ui = useUI();
  const list = ["USD", "EUR", "RUB"].filter((c) => rates?.[c]);
  return (
    <Sheet title="Valyuta kurslari" closing={closing} onClose={() => ui.close(sheetId)}>
      {list.length ? (
        <div className="kv">
          {list.map((c) => (
            <div className="kv-row" key={c}>
              <span>1 {CURRENCIES[c].label} ({c})</span>
              <b className="num">{fmtMoney(rates[c], "UZS")}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted center">Kurslar hali yuklanmagan.</div>
      )}
      <div className="muted small center" style={{ marginTop: 14 }}>
        Manba: O'zbekiston Respublikasi Markaziy banki.
        {rates?.updatedAt ? ` Yangilangan: ${fmtDate(rates.updatedAt)}.` : ""}
        <br />
        Kurslar faqat bir necha valyutadagi umumiy balansni so'mga o'girish uchun ishlatiladi.
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Yordam
// ---------------------------------------------------------------
export function HelpSheet({ sheetId, closing }) {
  const ui = useUI();
  const examples = [
    ["+500 ming savdo", "500 000 so'm kirim"],
    ["-120 ming taksi", "120 000 so'm chiqim"],
    ["-1.5 mln ijara", "1 500 000 so'm chiqim"],
    ["+$100 xizmat", "100 dollar kirim"],
  ];
  return (
    <Sheet title="Yordam" closing={closing} onClose={() => ui.close(sheetId)} tall>
      <div className="help-block">
        <h4>💬 Botda tez yozish</h4>
        <p>Botga summa va izohni yozing — qolganini bot so'raydi:</p>
        <div className="kv">
          {examples.map(([a, b]) => (
            <div className="kv-row" key={a}><code>{a}</code><span>{b}</span></div>
          ))}
        </div>
        <p className="muted small">«ming» = 1 000, «mln» = 1 000 000.</p>
      </div>
      <div className="help-block">
        <h4>🤝 Qarzlar</h4>
        <p><b>Menga qarzdor</b> — mijoz sizga to'lashi kerak. <b>Men qarzdorman</b> — siz ta'minotchiga to'laysiz. To'lov yozilganda pul avtomatik tanlangan hisobga kirim/chiqim bo'ladi. Muddat kelganda bot eslatadi.</p>
      </div>
      <div className="help-block">
        <h4>📊 Hisobotlar</h4>
        <p>Foyda = kirim − chiqim. «Hisobotlar» bo'limida davrni tanlang va Excel faylni Telegram'ga oling. Bot har kuni kechqurun kunlik hisobotni o'zi yuboradi.</p>
      </div>
      <div className="help-block">
        <h4>🔐 Xavfsizlik</h4>
        <p>Ilova faqat egasi ruxsat bergan foydalanuvchilarga ochiladi. Xodimlar balans va hisobotlarni ko'rmaydi.</p>
      </div>
    </Sheet>
  );
}
