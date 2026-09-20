import { useRef, useState } from "react";
import { X } from "lucide-react";

// Pastdan qalqib chiqadigan oyna (bottom sheet). Yuqoridagi tutqichdan pastga tortib yopish mumkin.
export default function Sheet({ title, children, footer, closing, onClose, headerRight, tall = false }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(null);

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    if (dragY > 110) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div className="sheet-root">
      <div className={`backdrop ${closing ? "out" : ""}`} onClick={onClose} />
      <div
        className={`sheet ${tall ? "tall" : ""} ${closing ? "out" : ""}`}
        role="dialog"
        aria-modal="true"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="sheet-top" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet-grab" />
          <div className="sheet-head">
            <h3>{title}</h3>
            <div className="sheet-head-right">
              {headerRight}
              <button className="icon-btn" onClick={onClose} aria-label="Yopish">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
