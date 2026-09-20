import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lock, Plus, Trash2 } from "lucide-react";
import Sheet from "../ui/Sheet";
import { AmountInput, Avatar, Badge, Chip, EmptyState, ErrorBox, Field, ListSkeleton, Segmented, cx } from "../ui/common";
import { useApp } from "../AppContext";
import { useUI } from "../ui/UIContext";
import { useAction } from "../lib/hooks";
import { api } from "../lib/api";
import { ACCOUNT_TYPES, EMOJI_CHOICES, ROLE_LABEL } from "../lib/constants";
import { CURRENCIES, fmtMoney, groupInput, parseInput } from "../lib/format";

// ---------------------------------------------------------------
// Hisoblar
// ---------------------------------------------------------------
export function AccountsSheet({ sheetId, closing }) {
  const { accounts } = useApp();
  const ui = useUI();
  return (
    <Sheet
      title="Hisoblarim"
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <button className="btn btn-primary btn-block btn-lg" onClick={() => ui.open("accountForm", {})}>
          <Plus size={18} /> Hisob qo'shish
        </button>
      }
    >
      {accounts.length ? (
        <div className="card-list">
          {accounts.map((a) => (
            <button className="row" key={a.id} onClick={() => ui.open("accountForm", { account: a })}>
              <span className="tx-icon t-neutral">{a.icon}</span>
              <span className="row-main">
                <span className="row-title">{a.name}</span>
                <span className="row-sub">{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label} · {a.currency}</span>
              </span>
              <span className="row-amount num">{a.balance !== undefined ? fmtMoney(a.balance, a.currency) : ""}</span>
              <ChevronRight size={18} className="chev" />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon="💼" title="Hisoblar yo'q" text="Naqd pul, karta yoki bank hisobini qo'shing." />
      )}
    </Sheet>
  );
}

export function AccountForm({ sheetId, closing, account }) {
  const { allCurrencies } = useApp();
  const ui = useUI();
  const run = useAction();
  const editing = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "CASH");
  const [currency, setCurrency] = useState(account?.currency ?? "UZS");
  const [initial, setInitial] = useState(account && account.initialBalance ? groupInput(String(account.initialBalance)) : "");
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const icon = ACCOUNT_TYPES.find((t) => t.value === type)?.icon;
    try {
      if (editing) {
        await run(
          () => api(`/accounts/${account.id}`, { method: "PATCH", body: { name: name.trim(), type, icon, initialBalance: parseInput(initial) } }),
          { success: "Hisob yangilandi" }
        );
      } else {
        await run(
          () => api("/accounts", { method: "POST", body: { name: name.trim(), type, currency, icon, initialBalance: parseInput(initial) } }),
          { success: "Hisob qo'shildi" }
        );
      }
      ui.close(sheetId);
    } catch {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await ui.confirm({
      title: "Hisobni o'chirish",
      message: "Operatsiyasi bo'lmagan hisob o'chiriladi, operatsiyasi bor hisob esa arxivga o'tadi (qoldiq 0 bo'lishi kerak).",
      confirmText: "Davom etish",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await run(() => api(`/accounts/${account.id}`, { method: "DELETE" }));
      ui.toast(res.archived ? "Hisob arxivga o'tkazildi" : "Hisob o'chirildi", "success");
      ui.close(sheetId);
    } catch {
      /* xabar ko'rsatilgan */
    }
  };

  return (
    <Sheet
      title={editing ? "Hisobni tahrirlash" : "Yangi hisob"}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      footer={
        <div className="foot-actions">
          {editing ? (
            <button className="btn btn-danger-soft" onClick={remove} aria-label="O'chirish">
              <Trash2 size={18} />
            </button>
          ) : null}
          <button className="btn btn-primary btn-grow btn-lg" disabled={!valid || busy} onClick={submit}>
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      }
    >
      <Field label="Nomi">
        <input className="input" placeholder="Masalan: Naqd pul, Uzcard, Hisob raqam" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
      </Field>
      <Field label="Turi">
        <div className="chip-scroll">
          {ACCOUNT_TYPES.map((t) => (
            <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
              {t.icon} {t.label}
            </Chip>
          ))}
        </div>
      </Field>
      {!editing ? (
        <Field label="Valyuta">
          <div className="chip-scroll">
            {allCurrencies.map((c) => (
              <Chip key={c.code} active={currency === c.code} onClick={() => setCurrency(c.code)}>
                {c.label} ({c.code})
              </Chip>
            ))}
          </div>
        </Field>
      ) : null}
      <Field label="Boshlang'ich qoldiq" hint="Hisobda hozir bor pul. Keyingi kirim-chiqimlar shunga qo'shiladi.">
        <AmountInput value={initial} onChange={setInitial} currency={editing ? account.currency : currency} />
      </Field>
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Toifalar
// ---------------------------------------------------------------
export function CategoriesSheet({ sheetId, closing }) {
  const { categories } = useApp();
  const ui = useUI();
  const [type, setType] = useState("EXPENSE");
  const list = categories.filter((c) => c.type === type);
  const custom = list.filter((c) => !c.isSystem);
  const system = list.filter((c) => c.isSystem);

  return (
    <Sheet
      title="Toifalar"
      closing={closing}
      onClose={() => ui.close(sheetId)}
      tall
      footer={
        <button className="btn btn-primary btn-block btn-lg" onClick={() => ui.open("categoryForm", { type })}>
          <Plus size={18} /> {type === "INCOME" ? "Kirim" : "Chiqim"} toifasini qo'shish
        </button>
      }
    >
      <Segmented
        options={[
          { value: "EXPENSE", label: "Chiqim", tone: "expense" },
          { value: "INCOME", label: "Kirim", tone: "income" },
        ]}
        value={type}
        onChange={setType}
      />
      <div className="card-list">
        {custom.map((c) => (
          <button className="row" key={c.id} onClick={() => ui.open("categoryForm", { category: c, type })}>
            <span className="tx-icon t-neutral">{c.icon || "•"}</span>
            <span className="row-main"><span className="row-title">{c.name}</span></span>
            <ChevronRight size={18} className="chev" />
          </button>
        ))}
      </div>
      {system.length ? (
        <>
          <div className="section-mini">Tizim toifalari (qarz operatsiyalari uchun)</div>
          <div className="card-list">
            {system.map((c) => (
              <div className="row" key={c.id}>
                <span className="tx-icon t-neutral">{c.icon || "•"}</span>
                <span className="row-main">
                  <span className="row-title">{c.name}</span>
                  <span className="row-sub">{c.excludeFromProfit ? "Foydaga kirmaydi" : "Foydaga kiradi"}</span>
                </span>
                <Lock size={16} className="chev" />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

export function CategoryForm({ sheetId, closing, category, type }) {
  const ui = useUI();
  const run = useAction();
  const editing = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await run(
        () =>
          editing
            ? api(`/categories/${category.id}`, { method: "PATCH", body: { name: name.trim(), icon: icon || undefined } })
            : api("/categories", { method: "POST", body: { name: name.trim(), type, icon: icon || undefined } }),
        { success: editing ? "Toifa yangilandi" : "Toifa qo'shildi" }
      );
      ui.close(sheetId);
    } catch {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await ui.confirm({
      title: "Toifani o'chirish",
      message: "Ishlatilmagan toifa o'chiriladi, ishlatilgani esa arxivga o'tadi (eski operatsiyalar saqlanadi).",
      confirmText: "Davom etish",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await run(() => api(`/categories/${category.id}`, { method: "DELETE" }));
      ui.toast(res.archived ? "Toifa arxivga o'tkazildi" : "Toifa o'chirildi", "success");
      ui.close(sheetId);
    } catch {
      /* xabar ko'rsatilgan */
    }
  };

  return (
    <Sheet
      title={editing ? "Toifani tahrirlash" : `Yangi ${type === "INCOME" ? "kirim" : "chiqim"} toifasi`}
      closing={closing}
      onClose={() => ui.close(sheetId)}
      tall
      footer={
        <div className="foot-actions">
          {editing ? (
            <button className="btn btn-danger-soft" onClick={remove} aria-label="O'chirish"><Trash2 size={18} /></button>
          ) : null}
          <button className="btn btn-primary btn-grow btn-lg" disabled={!valid || busy} onClick={submit}>
            {busy ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      }
    >
      <Field label="Nomi">
        <input className="input" placeholder="Masalan: Ijara, Reklama, Savdo" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
      </Field>
      <Field label="Belgi (emoji)">
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((e) => (
            <button key={e} className={cx("emoji-cell", icon === e && "active")} onClick={() => setIcon(e)}>{e}</button>
          ))}
        </div>
      </Field>
    </Sheet>
  );
}

// ---------------------------------------------------------------
// Xodimlar (faqat egasi)
// ---------------------------------------------------------------
const STATUS_BADGE = { PENDING: ["warn", "Kutmoqda"], ACTIVE: ["success", "Faol"], BLOCKED: ["danger", "Bloklangan"] };

export function UsersSheet({ sheetId, closing }) {
  const ui = useUI();
  const run = useAction();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["users"], queryFn: () => api("/users") });
  const [openId, setOpenId] = useState(null);

  const update = async (user, patch, message) => {
    try {
      await run(() => api(`/users/${user.id}`, { method: "PATCH", body: patch }), { success: message });
      setOpenId(null);
    } catch {
      /* xabar ko'rsatilgan */
    }
  };

  return (
    <Sheet title="Xodimlar" closing={closing} onClose={() => ui.close(sheetId)} tall>
      <div className="notice info">
        Yangi odam botga <b>/start</b> yuborsa, sizga ruxsat so'rovi keladi. Bu yerdan ham tasdiqlashingiz mumkin.
        <br />
        <b>Xodim</b> — faqat kirim/chiqim yozadi. <b>Buxgalter</b> — hisobot, qarz va hisoblarni ham ko'radi.
      </div>
      {isPending ? <ListSkeleton rows={3} /> : error ? <ErrorBox error={error} onRetry={refetch} /> : (
        <div className="card-list">
          {data.items.map((u) => {
            const [tone, label] = STATUS_BADGE[u.status];
            const isOwner = u.role === "OWNER";
            return (
              <div className="user-card" key={u.id}>
                <button className="row" onClick={() => !isOwner && setOpenId(openId === u.id ? null : u.id)}>
                  <Avatar name={u.fullName} />
                  <span className="row-main">
                    <span className="row-title">{u.fullName}</span>
                    <span className="row-sub">{u.username ? `@${u.username} · ` : ""}{ROLE_LABEL[u.role]}</span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </button>
                {openId === u.id && !isOwner ? (
                  <div className="user-actions">
                    {u.status !== "ACTIVE" ? (
                      <>
                        <button className="btn btn-soft btn-sm" onClick={() => update(u, { status: "ACTIVE", role: "STAFF" }, "Xodim sifatida qabul qilindi")}>👷 Xodim</button>
                        <button className="btn btn-soft btn-sm" onClick={() => update(u, { status: "ACTIVE", role: "ACCOUNTANT" }, "Buxgalter sifatida qabul qilindi")}>🧮 Buxgalter</button>
                      </>
                    ) : (
                      <>
                        {u.role !== "STAFF" ? <button className="btn btn-soft btn-sm" onClick={() => update(u, { role: "STAFF" }, "Rol o'zgartirildi")}>👷 Xodim qilish</button> : null}
                        {u.role !== "ACCOUNTANT" ? <button className="btn btn-soft btn-sm" onClick={() => update(u, { role: "ACCOUNTANT" }, "Rol o'zgartirildi")}>🧮 Buxgalter qilish</button> : null}
                      </>
                    )}
                    {u.status !== "BLOCKED" ? (
                      <button className="btn btn-danger-soft btn-sm" onClick={() => update(u, { status: "BLOCKED" }, u.status === "PENDING" ? "Rad etildi" : "Bloklandi")}>
                        {u.status === "PENDING" ? "Rad etish" : "Bloklash"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
