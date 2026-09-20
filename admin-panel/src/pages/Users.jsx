import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { Avatar, Badge, Card, EmptyState, ErrorBox, Spinner, useUI } from "../ui";
import { ROLE_LABEL, fmtDateTime, fmtShort } from "../format";

const STATUS = { PENDING: ["warn", "Kutmoqda"], ACTIVE: ["success", "Faol"], BLOCKED: ["danger", "Bloklangan"] };

export default function Users() {
  const qc = useQueryClient();
  const ui = useUI();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["users"], queryFn: () => api("/users"), refetchInterval: 15_000 });

  const update = async (user, patch, message) => {
    try {
      await api(`/users/${user.id}`, { method: "PATCH", body: patch });
      qc.invalidateQueries();
      ui.toast(message, "success");
    } catch (err) {
      ui.toast(err.message, "error");
    }
  };

  const block = async (user) => {
    const ok = await ui.confirm({
      title: user.status === "PENDING" ? "So'rovni rad etish" : "Foydalanuvchini bloklash",
      message: `«${user.fullName}» botdan va ilovadan foydalana olmaydi.`,
      confirmText: user.status === "PENDING" ? "Rad etish" : "Bloklash",
      danger: true,
    });
    if (ok) update(user, { status: "BLOCKED" }, user.status === "PENDING" ? "Rad etildi" : "Bloklandi");
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={refetch} />;

  const pending = data.items.filter((u) => u.status === "PENDING");

  return (
    <>
      <div className="notice info">
        Yangi odam botga <b>/start</b> yuborsa, sizga Telegram'da ruxsat so'rovi keladi va bu yerda ham ko'rinadi.
        <b> Xodim</b> — faqat kirim/chiqim yozadi. <b>Buxgalter</b> — hisobot, qarz va hisoblarni ham ko'radi.
      </div>

      {pending.length ? (
        <Card title={`⏳ Ruxsat kutayotganlar (${pending.length})`} pad={false} className="pending-card">
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}>
                    <td><span className="person"><Avatar name={u.fullName} /> <span><b>{u.fullName}</b><br /><small className="muted">{u.username ? `@${u.username} · ` : ""}ID {u.telegramId}</small></span></span></td>
                    <td className="muted">{fmtDateTime(u.createdAt)}</td>
                    <td className="actions-col wide">
                      <button className="btn btn-sm btn-primary" onClick={() => update(u, { status: "ACTIVE", role: "STAFF" }, "Xodim sifatida qabul qilindi")}>👷 Xodim</button>
                      <button className="btn btn-sm" onClick={() => update(u, { status: "ACTIVE", role: "ACCOUNTANT" }, "Buxgalter sifatida qabul qilindi")}>🧮 Buxgalter</button>
                      <button className="btn btn-sm btn-danger-soft" onClick={() => block(u)}>Rad etish</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card title="Barcha foydalanuvchilar" pad={false}>
        {data.items.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Foydalanuvchi</th><th>Telegram ID</th><th>Rol</th><th>Holat</th><th>Qo'shilgan</th><th>Oxirgi faollik</th><th className="actions-col" /></tr></thead>
              <tbody>
                {data.items.map((u) => {
                  const [tone, label] = STATUS[u.status];
                  const owner = u.role === "OWNER";
                  return (
                    <tr key={u.id}>
                      <td><span className="person"><Avatar name={u.fullName} /> <span><b>{u.fullName}</b>{u.username ? <><br /><small className="muted">@{u.username}</small></> : null}</span></span></td>
                      <td className="num muted">{u.telegramId}</td>
                      <td>
                        {owner ? (
                          <Badge tone="dark">Egasi</Badge>
                        ) : (
                          <select className="input compact" value={u.role} disabled={u.status === "PENDING"} onChange={(e) => update(u, { role: e.target.value }, "Rol o'zgartirildi")}>
                            <option value="STAFF">{ROLE_LABEL.STAFF}</option>
                            <option value="ACCOUNTANT">{ROLE_LABEL.ACCOUNTANT}</option>
                          </select>
                        )}
                      </td>
                      <td><Badge tone={tone}>{label}</Badge></td>
                      <td>{fmtShort(u.createdAt)}</td>
                      <td>{u.lastSeenAt ? fmtDateTime(u.lastSeenAt) : <span className="muted">—</span>}</td>
                      <td className="actions-col wide">
                        {owner ? null : u.status === "BLOCKED" ? (
                          <button className="btn btn-sm" onClick={() => update(u, { status: "ACTIVE", role: u.role }, "Ruxsat qayta tiklandi")}>Faollashtirish</button>
                        ) : u.status === "ACTIVE" ? (
                          <button className="btn btn-sm btn-danger-soft" onClick={() => block(u)}>Bloklash</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="👥" title="Foydalanuvchi yo'q" />}
      </Card>
    </>
  );
}
