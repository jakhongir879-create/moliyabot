import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChartColumn, Check, Handshake, House, Plus, ReceiptText, UserRound, X } from "lucide-react";
import { AppProvider } from "./AppContext";
import { UIProvider, useUI } from "./ui/UIContext";
import { AUTH_CODES, api } from "./lib/api";
import { hasTelegram, initTelegram } from "./lib/telegram";
import { useBootstrapQuery } from "./lib/hooks";
import { ErrorBox, Skeleton, cx } from "./ui/common";

import Home from "./screens/Home";
import Transactions from "./screens/Transactions";
import Debts from "./screens/Debts";
import Reports from "./screens/Reports";
import Profile from "./screens/Profile";
import Onboarding from "./screens/Onboarding";
import NoAccess from "./screens/NoAccess";

import TransactionForm from "./sheets/TransactionForm";
import TransactionDetail from "./sheets/TransactionDetail";
import { DebtDetail, DebtForm, PaymentForm } from "./sheets/DebtSheets";
import { AccountForm, AccountsSheet, CategoriesSheet, CategoryForm, UsersSheet } from "./sheets/ManageSheets";
import { HelpSheet, RangeSheet, RatesSheet, TxFiltersSheet } from "./sheets/MiscSheets";

const SHEETS = {
  txForm: TransactionForm,
  txDetail: TransactionDetail,
  debtForm: DebtForm,
  debtDetail: DebtDetail,
  paymentForm: PaymentForm,
  accounts: AccountsSheet,
  accountForm: AccountForm,
  categories: CategoriesSheet,
  categoryForm: CategoryForm,
  users: UsersSheet,
  rates: RatesSheet,
  help: HelpSheet,
  range: RangeSheet,
  txFilters: TxFiltersSheet,
};

const NAV_MANAGER = [
  { id: "home", label: "Bosh sahifa", icon: House },
  { id: "transactions", label: "Operatsiyalar", icon: ReceiptText },
  { id: "debts", label: "Qarzlar", icon: Handshake },
  { id: "reports", label: "Hisobotlar", icon: ChartColumn },
  { id: "profile", label: "Profil", icon: UserRound },
];
const NAV_STAFF = [NAV_MANAGER[0], NAV_MANAGER[1], NAV_MANAGER[4]];

function SheetHost() {
  const ui = useUI();
  return ui.sheets.map((s) => {
    const Component = SHEETS[s.name];
    return Component ? <Component key={s.id} sheetId={s.id} closing={s.closing} {...s.props} /> : null;
  });
}

function ToastView() {
  const { toastState } = useUI();
  if (!toastState) return null;
  return (
    <div className={cx("toast", `toast-${toastState.tone}`)} key={toastState.key} role="status">
      {toastState.tone === "success" ? <Check size={17} /> : toastState.tone === "error" ? <X size={17} /> : null}
      <span>{toastState.message}</span>
    </div>
  );
}

function ConfirmView() {
  const { dialog, answerDialog } = useUI();
  if (!dialog) return null;
  return (
    <div className="dialog-root">
      <div className="backdrop" onClick={() => answerDialog(false)} />
      <div className="dialog" role="alertdialog" aria-modal="true">
        <h3>{dialog.title}</h3>
        <p>{dialog.message}</p>
        <div className="dialog-actions">
          <button className="btn btn-soft" onClick={() => answerDialog(false)}>{dialog.cancelText || "Bekor qilish"}</button>
          <button className={cx("btn", dialog.danger ? "btn-danger" : "btn-primary")} onClick={() => answerDialog(true)}>
            {dialog.confirmText || "Ha"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash-logo">💼</div>
      <div style={{ display: "grid", gap: 10, width: 220, marginTop: 20 }}>
        <Skeleton h={12} />
        <Skeleton h={12} w="70%" style={{ justifySelf: "center" }} />
      </div>
    </div>
  );
}

function Shell({ boot }) {
  const ui = useUI();
  const qc = useQueryClient();
  const [tab, setTab] = useState("home");
  const [txPreset, setTxPreset] = useState(null);
  const [introDone, setIntroDone] = useState(false);
  const [replayIntro, setReplayIntro] = useState(false);

  const value = useMemo(() => ({ ...boot }), [boot]);
  const { me, permissions } = boot;
  const nav = permissions.viewReports ? NAV_MANAGER : NAV_STAFF;

  const go = useCallback((next, params) => {
    if (next === "transactions") setTxPreset(params ? { ...params, nonce: Date.now() } : null);
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const finishIntro = async () => {
    setIntroDone(true);
    setReplayIntro(false);
    if (!me.onboarded) {
      try {
        await api("/me/onboarded", { method: "POST" });
        qc.invalidateQueries({ queryKey: ["bootstrap"] });
      } catch {
        /* keyingi safar yana ko'rsatiladi */
      }
    }
  };

  if ((!me.onboarded && !introDone) || replayIntro) return <Onboarding onDone={finishIntro} />;

  const fab =
    tab === "transactions" ? () => ui.open("txForm", { preset: {} }) : tab === "debts" && permissions.manageDebts ? () => ui.open("debtForm", {}) : null;

  return (
    <AppProvider value={{ ...value, perms: permissions }}>
      <div className="app">
        {tab === "home" && <Home go={go} />}
        {tab === "transactions" && <Transactions preset={txPreset} />}
        {tab === "debts" && permissions.manageDebts && <Debts />}
        {tab === "reports" && permissions.viewReports && <Reports />}
        {tab === "profile" && <Profile onShowIntro={() => setReplayIntro(true)} />}

        {fab ? (
          <button className="fab" onClick={fab} aria-label="Qo'shish">
            <Plus size={26} />
          </button>
        ) : null}

        <nav className="nav">
          <div className="nav-inner">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <button key={n.id} className={cx("nav-item", tab === n.id && "active")} onClick={() => go(n.id)}>
                  <Icon size={22} strokeWidth={tab === n.id ? 2.4 : 1.9} />
                  <span>{n.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      <SheetHost />
      <ConfirmView />
      <ToastView />
    </AppProvider>
  );
}

function Root() {
  const boot = useBootstrapQuery();

  useEffect(() => {
    initTelegram();
  }, []);

  if (!hasTelegram()) return <NoAccess code="NO_INIT_DATA" />;
  if (boot.isLoading) return <Splash />;
  if (boot.error) {
    if (AUTH_CODES.has(boot.error.code)) return <NoAccess code={boot.error.code} />;
    return (
      <div className="no-access">
        <ErrorBox error={boot.error} onRetry={boot.refetch} />
      </div>
    );
  }
  return <Shell boot={boot.data} />;
}

export default function App() {
  return (
    <UIProvider>
      <Root />
    </UIProvider>
  );
}
