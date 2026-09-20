import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Badge, Card, EmptyState, ErrorBox, Pagination, Spinner } from "../ui";
import { fmtDateTime, fmtMoney } from "../format";

const PAGE = 30;
const ACTIONS = {
  create: ["success", "Yaratdi"],
  update: ["info", "O'zgartirdi"],
  delete: ["danger", "O'chirdi"],
  archive: ["warn", "Arxivladi"],
  payment: ["success", "To'lov"],
  "delete-payment": ["danger", "To'lovni o'chirdi"],
};
const ENTITIES = { transaction: "Operatsiya", debt: "Qarz", account: "Hisob", category: "Toifa", user: "Foydalanuvchi", settings: "Sozlamalar" };

function describe(row) {
  const d = row.details;
  if (!d) return "";
  if (row.entity === "transaction") {
    const x = d.after || d;
    const bits = [];
    if (x.type) bits.push({ INCOME: "kirim", EXPENSE: "chiqim", TRANSFER: "o'tkazma" }[x.type] || x.type);
    if (x.amount) bits.push(fmtMoney(x.amount, x.currency));
    if (x.category) bits.push(x.category);
    if (x.account) bits.push(x.account);
    if (x.note) bits.push(`«${x.note}»`);
    if (d.via) bits.push(`(${d.via})`);
    return bits.join(" · ");
  }
  if (row.entity === "debt") {
    const x = d.after || d;
    return [x.person, x.amount ? fmtMoney(x.amount, x.currency || "UZS") : ""].filter(Boolean).join(" · ");
  }
  if (row.entity === "user") return [d.name, d.role, d.status].filter(Boolean).join(" · ");
  if (row.entity === "account" || row.entity === "category") return [d.name, d.currency, d.type].filter(Boolean).join(" · ");
  return "";
}

export default function Audit() {
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api("/audit", { params: { limit: PAGE, offset: (page - 1) * PAGE } }),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  return (
    <>
      <p className="muted" style={{ marginBottom: 14 }}>Kim, qachon va nimani yaratgan, o'zgartirgan yoki o'chirganini shu yerda ko'rasiz.</p>
      <Card pad={false}>
        {isPending ? <Spinner /> : error ? <ErrorBox error={error} onRetry={refetch} /> : data.items.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Vaqt</th><th>Kim</th><th>Amal</th><th>Obyekt</th><th>Tafsilot</th></tr></thead>
                <tbody>
                  {data.items.map((r) => {
                    const [tone, label] = ACTIONS[r.action] || ["neutral", r.action];
                    return (
                      <tr key={r.id}>
                        <td className="nowrap">{fmtDateTime(r.createdAt)}</td>
                        <td>{r.actorName}</td>
                        <td><Badge tone={tone}>{label}</Badge></td>
                        <td>{ENTITIES[r.entity] || r.entity}{r.entityId ? <span className="muted"> #{r.entityId}</span> : null}</td>
                        <td className="note-col wide" title={describe(r)}>{describe(r) || <span className="muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE} total={data.total} onChange={setPage} />
          </>
        ) : <EmptyState icon="📜" title="Jurnal bo'sh" />}
      </Card>
    </>
  );
}
