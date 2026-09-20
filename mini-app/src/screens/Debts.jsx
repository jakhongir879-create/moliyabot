import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUI } from "../ui/UIContext";
import { api } from "../lib/api";
import { Avatar, Badge, Chip, EmptyState, ErrorBox, ListSkeleton, Segmented } from "../ui/common";
import { dueInfo, fmtMoney } from "../lib/format";

const badgeTone = { late: "danger", soon: "warn", ok: "neutral", none: "neutral", done: "success" };

export default function Debts() {
  const ui = useUI();
  const [type, setType] = useState("RECEIVABLE");
  const [status, setStatus] = useState("OPEN");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["debts", type, status],
    queryFn: () => api("/debts", { params: { type, status } }),
  });

  const summary = data?.summary;
  const totals = summary ? Object.entries(summary.totals[type]) : [];
  const receivable = type === "RECEIVABLE";

  return (
    <div className="screen">
      <h1 className="page-title">Qarzlar</h1>

      <Segmented
        options={[
          { value: "RECEIVABLE", label: `Menga qarzdor${summary ? ` (${summary.counts.RECEIVABLE})` : ""}`, tone: "income" },
          { value: "PAYABLE", label: `Men qarzdorman${summary ? ` (${summary.counts.PAYABLE})` : ""}`, tone: "expense" },
        ]}
        value={type}
        onChange={setType}
      />

      <div className={`debt-summary ${receivable ? "inc" : "exp"}`}>
        <div className="muted small">{receivable ? "Sizga to'lashlari kerak" : "Siz to'lashingiz kerak"}</div>
        <div className="debt-summary-amount num">
          {totals.length ? totals.map(([c, v]) => fmtMoney(v, c)).join(" + ") : fmtMoney(0, "UZS")}
        </div>
        {summary?.overdue ? <Badge tone="danger">⚠️ Muddati o'tgan: {summary.overdue} ta</Badge> : null}
      </div>

      <div className="chip-scroll" style={{ marginBottom: 12 }}>
        <Chip active={status === "OPEN"} onClick={() => setStatus("OPEN")}>Ochiq</Chip>
        <Chip active={status === "CLOSED"} onClick={() => setStatus("CLOSED")}>Yopilgan</Chip>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorBox error={error} onRetry={refetch} />
      ) : data.items.length ? (
        <div className="card-list">
          {data.items.map((d) => {
            const due = dueInfo(d);
            const progress = d.amount ? Math.round((d.paid / d.amount) * 100) : 0;
            return (
              <button className="debt-card" key={d.id} onClick={() => ui.open("debtDetail", { debtId: d.id, initial: d })}>
                <div className="debt-card-top">
                  <Avatar name={d.personName} size={42} />
                  <span className="row-main">
                    <span className="row-title">{d.personName}</span>
                    <span className="row-sub">{d.note || d.phone || (receivable ? "Sizga qarzdor" : "Siz qarzdorsiz")}</span>
                  </span>
                  <span className="row-right">
                    <b className={`num ${receivable ? "pos" : "neg"}`}>{fmtMoney(d.status === "OPEN" ? d.remaining : d.amount, d.currency)}</b>
                    <Badge tone={badgeTone[due.tone]}>{due.text}</Badge>
                  </span>
                </div>
                {d.status === "OPEN" && d.paid > 0 ? (
                  <div className="debt-card-progress">
                    <div className="progress"><span style={{ width: `${progress}%` }} /></div>
                    <span className="muted small">{fmtMoney(d.paid, d.currency)} / {fmtMoney(d.amount, d.currency)}</span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={receivable ? "🤝" : "📄"}
          title={status === "OPEN" ? "Ochiq qarz yo'q" : "Yopilgan qarz yo'q"}
          text={receivable ? "Nasiyaga tovar bergan mijozlaringizni shu yerda yuriting." : "Ta'minotchi va boshqalardan olgan qarzlaringizni shu yerda yuriting."}
          action={status === "OPEN" ? <button className="btn btn-primary" onClick={() => ui.open("debtForm", { presetType: type })}>Qarz qo'shish</button> : null}
        />
      )}
    </div>
  );
}
