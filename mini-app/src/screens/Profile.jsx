import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, CircleHelp, Coins, Layers, Sparkles, Tags, UsersRound, Wallet } from "lucide-react";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useAction } from "../lib/hooks";
import { api } from "../lib/api";
import { Avatar, Badge, Switch } from "../ui/common";
import { ROLE_LABEL } from "../lib/constants";

function MenuRow({ icon, label, sub, onClick, right }) {
  return (
    <button className="menu-row" onClick={onClick}>
      <span className="menu-ic">{icon}</span>
      <span className="row-main">
        <span className="row-title">{label}</span>
        {sub ? <span className="row-sub">{sub}</span> : null}
      </span>
      {right}
      <ChevronRight size={18} className="chev" />
    </button>
  );
}

export default function Profile({ onShowIntro }) {
  const { me, perms, accounts, business } = useApp();
  const ui = useUI();
  const run = useAction();

  const [receipts, setReceipts] = useState(me.sendReceipts);
  const [reports, setReports] = useState(me.receiveReports);
  useEffect(() => {
    setReceipts(me.sendReceipts);
    setReports(me.receiveReports);
  }, [me.sendReceipts, me.receiveReports]);

  const users = useQuery({ queryKey: ["users"], queryFn: () => api("/users"), enabled: perms.manageUsers });
  const pending = users.data?.items.filter((u) => u.status === "PENDING").length || 0;

  const toggle = async (key, value, setter) => {
    setter(value);
    try {
      await run(() => api("/me", { method: "PATCH", body: { [key]: value } }));
    } catch {
      setter(!value);
    }
  };

  return (
    <div className="screen">
      <h1 className="page-title">Profil</h1>

      <div className="profile-card">
        <Avatar name={me.fullName} size={64} tone="#111827" />
        <div className="profile-main">
          <div className="profile-name">{me.fullName}</div>
          <div className="muted">{me.username ? `@${me.username}` : `ID ${me.telegramId}`}</div>
        </div>
        <Badge tone={me.role === "OWNER" ? "dark" : "neutral"}>{ROLE_LABEL[me.role]}</Badge>
      </div>
      <div className="muted small" style={{ margin: "-4px 4px 16px" }}>{business?.name}</div>

      {perms.manageAccounts || perms.manageCategories || perms.manageUsers ? (
        <>
          <div className="section-mini">Boshqaruv</div>
          <div className="card-list">
            {perms.manageAccounts ? (
              <MenuRow icon={<Wallet size={20} />} label="Hisoblarim" sub={`${accounts.length} ta hisob`} onClick={() => ui.open("accounts")} />
            ) : null}
            {perms.manageCategories ? (
              <MenuRow icon={<Tags size={20} />} label="Toifalar" sub="Kirim va chiqim toifalari" onClick={() => ui.open("categories")} />
            ) : null}
            {perms.manageUsers ? (
              <MenuRow
                icon={<UsersRound size={20} />}
                label="Xodimlar"
                sub="Ruxsat berish va rollar"
                onClick={() => ui.open("users")}
                right={pending ? <Badge tone="warn">{pending} ta yangi</Badge> : null}
              />
            ) : null}
            {perms.viewBalances ? (
              <MenuRow icon={<Coins size={20} />} label="Valyuta kurslari" sub="Markaziy bank kursi" onClick={() => ui.open("rates")} />
            ) : null}
          </div>
        </>
      ) : null}

      <div className="section-mini">Bildirishnomalar</div>
      <div className="card-list">
        <div className="menu-row static">
          <span className="menu-ic"><Bell size={20} /></span>
          <span className="row-main">
            <span className="row-title">Botda chek yuborish</span>
            <span className="row-sub">Ilovada yozgan operatsiyangiz haqida xabar</span>
          </span>
          <Switch checked={receipts} onChange={(v) => toggle("sendReceipts", v, setReceipts)} />
        </div>
        {perms.viewReports ? (
          <div className="menu-row static">
            <span className="menu-ic"><Layers size={20} /></span>
            <span className="row-main">
              <span className="row-title">Kunlik hisobot va eslatmalar</span>
              <span className="row-sub">Kechqurun hisobot, qarz muddati eslatmasi</span>
            </span>
            <Switch checked={reports} onChange={(v) => toggle("receiveReports", v, setReports)} />
          </div>
        ) : null}
      </div>

      <div className="section-mini">Boshqa</div>
      <div className="card-list">
        <MenuRow icon={<CircleHelp size={20} />} label="Yordam" sub="Tezkor yozish va imkoniyatlar" onClick={() => ui.open("help")} />
        <MenuRow icon={<Sparkles size={20} />} label="Ilova bilan tanishish" sub="Qisqa ko'rsatma" onClick={onShowIntro} />
      </div>

      <div className="muted small center" style={{ padding: "22px 0 4px" }}>Moliya · v1.0</div>
    </div>
  );
}
