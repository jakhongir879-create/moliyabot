import { useState } from "react";
import { Lock } from "lucide-react";
import { api, isRemoteApi, setToken } from "../api";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const { token } = await api("/login", { method: "POST", body: { password } });
      setToken(token);
      onLogin();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">💼</div>
        <h1>Moliya — Admin Panel</h1>
        <p className="muted">
          {isRemoteApi
            ? "Kirish uchun serverdagi (Render) ADMIN_PASSWORD parolini kiriting"
            : "Kirish uchun .env faylidagi ADMIN_PASSWORD parolini kiriting"}
        </p>
        <label className="field">
          <span className="field-label">Parol</span>
          <div className="input-icon">
            <Lock size={17} />
            <input className="input" type="password" autoFocus placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="btn btn-primary btn-lg" disabled={!password || busy}>{busy ? "Tekshirilmoqda..." : "Kirish"}</button>
        <p className="login-foot muted">
          {isRemoteApi ? "Faqat ruxsat berilgan kishilar uchun. Parolni hech kimga bermang." : "Bu panel faqat shu kompyuterdan (localhost) ochiladi."}
        </p>
      </form>
    </div>
  );
}
