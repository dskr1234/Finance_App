import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function PaymentHistory({ financeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPayments(financeId);
        setItems(res.items || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [financeId]);

  if (loading) return <div className="text-xs text-slate-500">Loading payments…</div>;
  if (!items.length) return <div className="text-xs text-slate-500">No payments yet.</div>;

  const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : n;

  return (
    <div className="grid gap-1">
      {items.map(p => (
        <div key={p.id} className="chip flex items-center justify-between">
          <div className="text-xs text-slate-600">{p.date} • {p.type}{p.note ? ` • ${p.note}` : ""}</div>
          <div className="font-medium">₹{fmt(p.amount)}</div>
        </div>
      ))}
    </div>
  );
}
