import { useRef, useState } from "react";
import { cx } from "../ui/common";

const SLIDES = [
  {
    title: "Pulingiz nazoratda",
    text: "Kirim va chiqimlarni bir necha soniyada yozib boring. Har bir so'm hisobda.",
    art: "list",
  },
  {
    title: "Bu qanday ishlaydi?",
    text: "Summani kiriting, toifani tanlang va saqlang. Balans, qarzlar va hisobotlar o'zi hisoblanadi.",
    art: "steps",
  },
  {
    title: "Hisobotlar bir zumda",
    text: "Kunlik, haftalik va oylik foyda, grafiklar va Excel hisobot — hammasi bir joyda.",
    art: "chart",
  },
];

function Art({ kind }) {
  if (kind === "list") {
    return (
      <div className="art art-list">
        <div className="art-row"><span className="art-ic inc">🛒</span><span>Savdo tushumi</span><b className="pos">+1 250 000</b></div>
        <div className="art-row"><span className="art-ic exp">🚚</span><span>Transport</span><b className="neg">−85 000</b></div>
        <div className="art-row"><span className="art-ic exp">🏠</span><span>Ijara</span><b className="neg">−3 500 000</b></div>
        <div className="art-total">Bugun: <b>+1 165 000 so'm</b></div>
      </div>
    );
  }
  if (kind === "steps") {
    return (
      <div className="art art-steps">
        {[
          ["1", "Summani kiriting", "500 000"],
          ["2", "Toifani tanlang", "🛒 Savdo"],
          ["3", "Saqlang", "✓ Tayyor"],
        ].map(([n, t, s]) => (
          <div className="art-step" key={n}>
            <span className="art-num">{n}</span>
            <div><b>{t}</b><span>{s}</span></div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="art art-chart">
      <div className="art-badge">▲ 24%</div>
      <div className="art-bars">
        {[38, 55, 42, 70, 60, 88, 74].map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
      <div className="art-caption">Foyda o'tgan haftaga nisbatan</div>
    </div>
  );
}

// Faqat birinchi kirishda ko'rsatiladigan 3 ta slayd
export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef(null);
  const last = index === SLIDES.length - 1;

  const goTo = (i) => {
    setIndex(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  return (
    <div className="onboarding">
      <div className="onb-top">
        <span className="onb-brand">💼 Moliya</span>
        {!last ? <button className="link-btn" onClick={onDone}>O'tkazib yuborish</button> : <span />}
      </div>

      <div className="onb-slides" ref={scroller} onScroll={onScroll}>
        {SLIDES.map((s) => (
          <section className="onb-slide" key={s.title}>
            <Art kind={s.art} />
            <h1>{s.title}</h1>
            <p>{s.text}</p>
          </section>
        ))}
      </div>

      <div className="onb-bottom">
        <div className="dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={cx("dot-i", i === index && "active")} onClick={() => goTo(i)} aria-label={`${i + 1}-slayd`} />
          ))}
        </div>
        <button className="btn btn-primary btn-block btn-xl" onClick={() => (last ? onDone() : goTo(index + 1))}>
          {last ? "Boshlash" : "Keyingisi"}
        </button>
      </div>
    </div>
  );
}
