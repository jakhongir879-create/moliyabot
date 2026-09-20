import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { AmountField, Badge, Card, EmptyState, ErrorBox, Field, Modal, Spinner, cx, useUI } from "../ui";
import { ACCOUNT_TYPES, CURRENCIES, EMOJI_CHOICES, fmtMoney, groupInput, parseInput } from "../format";
import { useMeta } from "../meta";

// ---------------------------------------------------------------
// Hisoblar
// ---------------------------------------------------------------
function AccountModal({ account, onClose }) {
  const { allCurrencies } = useMeta();
  const qc = useQueryClient();
  const ui = useUI();
  const editing = Boolean(account);

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "CASH");
  const [currency, setCurrency] = useState(account?.currency ?? "UZS");
  const [initial, setInitial] = useState(account && account.initialBalance ? groupInput(String(account.initialBalance)) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Hisob nomini kiriting");
    setBusy(true);
    setError("");
    const icon = ACCOUNT_TYPES.find((t) => t.value === type)?.icon;
    try {
      if (editing) await api(`/accounts/${account.id}`, { method: "PATCH", body: { name: name.trim(), type, icon, initialBalance: parseInput(initial) } });
      else await api("/accounts", { method: "POST", body: { name: name.trim(), type, currency, icon, initialBalance: parseInput(initial) } });
      qc.invalidateQueries();
      ui.toast(editing ? "Hisob yangilandi" : "Hisob qo'shildi", "success");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? "Hisobni tahrirlash" : "Yangi hisob"}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        </>
      }
    >
      <Field label="Nomi"><input className="input" autoFocus={!editing} maxLength={60} placeholder="Masalan: Naqd pul, Uzcard" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Turi">
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
      </Field>
      {!editing ? (
        <Field label="Valyuta">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {allCurrencies.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Boshlang'ich qoldiq" hint="Hisobda hozir bor pul. Keyingi operatsiyalar shunga qo'shiladi.">
        <AmountField value={initial} onChange={setInitial} currency={editing ? account.currency : currency} />
      </Field>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}

export function Accounts() {
  const qc = useQueryClient();
  const ui = useUI();
  const [modal, setModal] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["accounts", showArchived], queryFn: () => api("/accounts", { params: { all: showArchived ? 1 : undefined } }) });

  const remove = async (a) => {
    const ok = await ui.confirm({
      title: "Hisobni o'chirish",
      message: `«${a.name}» — operatsiyasi bo'lmasa o'chiriladi, bo'lsa arxivga o'tadi (qoldiq 0 bo'lishi kerak).`,
      confirmText: "Davom etish",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api(`/accounts/${a.id}`, { method: "DELETE" });
      qc.invalidateQueries();
      ui.toast(res.archived ? "Hisob arxivga o'tkazildi" : "Hisob o'chirildi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  const restore = async (a) => {
    try {
      await api(`/accounts/${a.id}`, { method: "PATCH", body: { isArchived: false } });
      qc.invalidateQueries();
      ui.toast("Hisob qayta tiklandi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  return (
    <>
      <div className="page-actions">
        <label className="check inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /><span>Arxivdagilarni ko'rsatish</span></label>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={17} /> Yangi hisob</button>
      </div>
      <Card pad={false}>
        {isPending ? <Spinner /> : error ? <ErrorBox error={error} onRetry={refetch} /> : data.items.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Hisob</th><th>Turi</th><th>Valyuta</th><th className="right">Boshlang'ich qoldiq</th><th className="right">Joriy qoldiq</th><th>Holat</th><th className="actions-col" /></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className={cx(a.isArchived && "dim")}>
                    <td><span className="person"><span className="emoji-badge">{a.icon}</span> {a.name}</span></td>
                    <td>{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}</td>
                    <td>{CURRENCIES[a.currency]?.label} ({a.currency})</td>
                    <td className="right num">{fmtMoney(a.initialBalance, a.currency)}</td>
                    <td className="right num strong">{fmtMoney(a.balance, a.currency)}</td>
                    <td>{a.isArchived ? <Badge>Arxivda</Badge> : <Badge tone="success">Faol</Badge>}</td>
                    <td className="actions-col">
                      {a.isArchived ? (
                        <button className="btn btn-sm" onClick={() => restore(a)}>Tiklash</button>
                      ) : (
                        <>
                          <button className="icon-btn" onClick={() => setModal({ account: a })} aria-label="Tahrirlash"><Pencil size={16} /></button>
                          <button className="icon-btn danger" onClick={() => remove(a)} aria-label="O'chirish"><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="💼" title="Hisob yo'q" />}
      </Card>
      {modal ? <AccountModal account={modal.account} onClose={() => setModal(null)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------
// Toifalar
// ---------------------------------------------------------------
function CategoryModal({ category, type, onClose }) {
  const qc = useQueryClient();
  const ui = useUI();
  const editing = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Toifa nomini kiriting");
    setBusy(true);
    setError("");
    try {
      if (editing) await api(`/categories/${category.id}`, { method: "PATCH", body: { name: name.trim(), icon: icon || undefined } });
      else await api("/categories", { method: "POST", body: { name: name.trim(), type, icon: icon || undefined } });
      qc.invalidateQueries();
      ui.toast(editing ? "Toifa yangilandi" : "Toifa qo'shildi", "success");
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? "Toifani tahrirlash" : `Yangi ${type === "INCOME" ? "kirim" : "chiqim"} toifasi`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor qilish</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        </>
      }
    >
      <Field label="Nomi"><input className="input" autoFocus={!editing} maxLength={60} placeholder="Masalan: Ijara, Reklama" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Belgi (emoji)">
        <div className="emoji-grid">
          {EMOJI_CHOICES.map((e) => <button type="button" key={e} className={cx("emoji-cell", icon === e && "active")} onClick={() => setIcon(e)}>{e}</button>)}
        </div>
      </Field>
      {error ? <div className="form-error">{error}</div> : null}
    </Modal>
  );
}

function CategoryColumn({ type, title, items, onAdd, onEdit, onDelete }) {
  const list = items.filter((c) => c.type === type);
  return (
    <Card title={title} action={<button className="btn btn-sm btn-primary" onClick={onAdd}><Plus size={15} /> Qo'shish</button>} pad={false}>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className={cx(c.isArchived && "dim")}>
                <td><span className="person"><span className="emoji-badge">{c.icon || "•"}</span> {c.name}</span></td>
                <td>
                  {c.isSystem ? <Badge tone="info"><Lock size={11} /> Tizim</Badge> : null}
                  {c.isArchived ? <Badge>Arxivda</Badge> : null}
                  {c.isSystem ? <span className="muted small"> {c.excludeFromProfit ? "foydaga kirmaydi" : "foydaga kiradi"}</span> : null}
                </td>
                <td className="actions-col">
                  {c.isSystem ? null : (
                    <>
                      <button className="icon-btn" onClick={() => onEdit(c)} aria-label="Tahrirlash"><Pencil size={16} /></button>
                      <button className="icon-btn danger" onClick={() => onDelete(c)} aria-label="O'chirish"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Categories() {
  const qc = useQueryClient();
  const ui = useUI();
  const [modal, setModal] = useState(null);
  const { data, isPending, error, refetch } = useQuery({ queryKey: ["categories-all"], queryFn: () => api("/categories", { params: { all: 1 } }) });

  const remove = async (c) => {
    const ok = await ui.confirm({
      title: "Toifani o'chirish",
      message: `«${c.name}» — ishlatilmagan bo'lsa o'chiriladi, ishlatilgan bo'lsa arxivga o'tadi (eski operatsiyalar saqlanadi).`,
      confirmText: "Davom etish",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api(`/categories/${c.id}`, { method: "DELETE" });
      qc.invalidateQueries();
      ui.toast(res.archived ? "Toifa arxivga o'tkazildi" : "Toifa o'chirildi", "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;

  return (
    <>
      <div className="grid-2">
        <CategoryColumn type="INCOME" title="📥 Kirim toifalari" items={data.items} onAdd={() => setModal({ type: "INCOME" })} onEdit={(c) => setModal({ category: c, type: c.type })} onDelete={remove} />
        <CategoryColumn type="EXPENSE" title="📤 Chiqim toifalari" items={data.items} onAdd={() => setModal({ type: "EXPENSE" })} onEdit={(c) => setModal({ category: c, type: c.type })} onDelete={remove} />
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>
        «Tizim» toifalari qarz operatsiyalari uchun ishlatiladi. Qarz asosiy summasi harakati foyda hisobiga kirmaydi.
      </p>
      {modal ? <CategoryModal category={modal.category} type={modal.type} onClose={() => setModal(null)} /> : null}
    </>
  );
}
