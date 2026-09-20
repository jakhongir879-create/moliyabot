import { Component } from "react";

// Kutilmagan xatoda oq ekran o'rniga tushunarli xabar va "Qayta yuklash" tugmasi chiqadi
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Panel xatosi:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="boot" style={{ textAlign: "center", justifyItems: "center", gap: 12 }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h1 style={{ fontSize: 22, margin: 0 }}>Nimadir noto'g'ri ketdi</h1>
        <p className="muted" style={{ margin: 0, maxWidth: 360 }}>Panelda kutilmagan xatolik yuz berdi. Sahifani qayta yuklab ko'ring.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Qayta yuklash</button>
      </div>
    );
  }
}
