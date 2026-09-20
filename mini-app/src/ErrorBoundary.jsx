import { Component } from "react";
import { RefreshCw } from "lucide-react";

// Kutilmagan xatoda oq ekran o'rniga tushunarli xabar va "Qayta yuklash" tugmasi chiqadi
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Ilova xatosi:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="no-access">
        <div className="no-icon">⚠️</div>
        <h1>Nimadir noto'g'ri ketdi</h1>
        <p>Ilovada kutilmagan xatolik yuz berdi. Qayta yuklab ko'ring.</p>
        <button className="btn btn-soft" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Qayta yuklash
        </button>
      </div>
    );
  }
}
