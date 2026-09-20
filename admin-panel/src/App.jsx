import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChartColumn,
  Handshake,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScrollText,
  Settings as SettingsIcon,
  Tags,
  UsersRound,
  Wallet,
} from "lucide-react";
import { api, clearToken, getToken } from "./api";
import { Spinner, ErrorBox, cx } from "./ui";
import { MetaContext } from "./meta";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Debts from "./pages/Debts";
import { Accounts, Categories } from "./pages/Manage";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Audit from "./pages/Audit";

const NAV = [
  { to: "/", label: "Boshqaruv", icon: LayoutDashboard, end: true, title: "Boshqaruv paneli" },
  { to: "/transactions", label: "Operatsiyalar", icon: ReceiptText, title: "Operatsiyalar" },
  { to: "/debts", label: "Qarzlar", icon: Handshake, title: "Qarzlar" },
  { to: "/reports", label: "Hisobotlar", icon: ChartColumn, title: "Hisobotlar" },
  { to: "/accounts", label: "Hisoblar", icon: Wallet, title: "Hisoblar" },
  { to: "/categories", label: "Toifalar", icon: Tags, title: "Toifalar" },
  { to: "/users", label: "Xodimlar", icon: UsersRound, title: "Xodimlar", badge: true },
  { to: "/audit", label: "Jurnal", icon: ScrollText, title: "Faoliyat jurnali" },
  { to: "/settings", label: "Sozlamalar", icon: SettingsIcon, title: "Sozlamalar" },
];

function Layout({ onLogout }) {
  const qc = useQueryClient();
  const location = useLocation();
  const meta = useQuery({ queryKey: ["meta"], queryFn: () => api("/meta"), refetchInterval: 20_000 });
  const system = useQuery({ queryKey: ["system"], queryFn: () => api("/system"), refetchInterval: 10_000 });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const current = NAV.find((n) => (n.end ? location.pathname === "/" : location.pathname.startsWith(n.to)));

  if (meta.isLoading) return <div className="boot"><Spinner /></div>;
  if (meta.error) {
    return (
      <div className="boot">
        <ErrorBox error={meta.error} onRetry={() => meta.refetch()} />
      </div>
    );
  }

  const pending = meta.data.pendingUsers || 0;
  const bot = system.data?.bot;

  return (
    <MetaContext.Provider value={meta.data}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-logo">💼</span>
            <div>
              <b>Moliya</b>
              <small>{meta.data.business?.name}</small>
            </div>
          </div>
          <nav>
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("nav-link", isActive && "active")}>
                  <Icon size={19} />
                  <span>{n.label}</span>
                  {n.badge && pending ? <em className="nav-badge">{pending}</em> : null}
                </NavLink>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <div className="status-line" title={bot?.error || ""}>
              <i className={cx("dot", bot?.online ? "on" : "off")} />
              {bot?.online ? `Bot ishlayapti${bot.username ? ` · @${bot.username}` : ""}` : "Bot ulanmagan"}
            </div>
            <button className="nav-link" onClick={() => { clearToken(); qc.clear(); onLogout(); }}>
              <LogOut size={19} />
              <span>Chiqish</span>
            </button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <h1>{current?.title || "Moliya"}</h1>
            <span className="topbar-note">Toshkent vaqti bo'yicha</span>
          </header>
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/debts" element={<Debts />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/users" element={<Users />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </MetaContext.Provider>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  useEffect(() => {
    const onLogout = () => setAuthed(false);
    window.addEventListener("admin-logout", onLogout);
    return () => window.removeEventListener("admin-logout", onLogout);
  }, []);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <Layout onLogout={() => setAuthed(false)} />;
}
