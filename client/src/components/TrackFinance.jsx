import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { motion } from "framer-motion";
import EditFinanceModal from "./EditFinanceModal.jsx";
import PaymentHistory from "./PaymentHistory";

export default function TrackFinance({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [open, setOpen] = useState({});

  const [editOpen, setEditOpen] = useState(false);
  const [editRowData, setEditRowData] = useState(null);

  const fmt = (n) =>
    typeof n === "number"
      ? n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
      : n;

  async function load() {
    setLoading(true);
    try {
      const res = await api.listFinance();
      setItems(res.items || []);
    } catch (ex) {
      alert(ex.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function askPasscode() {
    const code = prompt("Enter passcode to proceed:");
    if (!code) throw new Error("Cancelled");
    return code;
  }

  async function payInterest(row) {
    try {
      const max = Number(row.outstanding_interest || 0);
      if (max <= 0) return alert("No interest due right now.");
      const def = String(Math.round(max));
      const v = prompt(`Enter interest amount (₹1 – ₹${fmt(max)}). Default pays all outstanding:`, def);
      if (!v) return;
      const amt = Number(v);
      if (!Number.isFinite(amt) || amt < 1) return alert("Amount must be at least ₹1");
      if (amt > max) return alert(`Max interest due is ₹${fmt(max)}`);
      const code = await askPasscode();
      await api.payInterest(row.id, code, amt);
      await load();
      onChanged?.();
    } catch (ex) {
      if (ex.message !== "Cancelled") alert(ex.message);
    }
  }

  async function payPrincipal(row) {
    const v = prompt("Enter principal amount to pay (₹):");
    if (!v) return;
    const amt = Number(v);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Invalid amount");
    try {
      const code = await askPasscode();
      await api.payPrincipal(row.id, amt, code);
      await load();
      onChanged?.();
    } catch (ex) {
      if (ex.message !== "Cancelled") alert(ex.message);
    }
  }

  async function topUp(row) {
    const v = prompt("Add money (₹):");
    if (!v) return;
    const amt = Number(v);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Invalid amount");
    try {
      await api.topUpFinance(row.id, amt);
      await load();
      onChanged?.();
    } catch (ex) {
      alert(ex.message);
    }
  }

  function openEdit(row) {
    console.log("Open edit for:", row.id, row);
    setEditRowData(row);
    setEditOpen(true);
  }

  async function remove(row) {
    if (row.current_principal > 0) return alert("Delete only when principal is 0");
    if (!confirm("Delete this cleared finance record?")) return;
    try {
      const code = await askPasscode();
      await api.deleteFinance(row.id, code);
      await load();
      onChanged?.();
    } catch (ex) {
      if (ex.message !== "Cancelled") alert(ex.message);
    }
  }

  const filtered = useMemo(() => {
    let arr = [...items].map((r) => ({
      ...r,
      current_principal:
        r.current_principal ??
        r.outstanding ??
        Math.max(0, (r.amount ?? r.principal) - (r.paid_principal || 0)),
      current_ipm: r.current_ipm ?? r.interest_per_month ?? 0,
      outstanding_interest: r.outstanding_interest ?? 0,
      months_elapsed: r.months_elapsed ?? 0,
    }));

    const t = q.trim().toLowerCase();
    if (t)
      arr = arr.filter(
        (r) =>
          (r.name || "").toLowerCase().includes(t) ||
          (r.contact || "").toLowerCase().includes(t)
      );

    if (status === "active") arr = arr.filter((r) => r.current_principal > 0);
    if (status === "cleared") arr = arr.filter((r) => r.current_principal === 0);
    if (status === "interestDue")
      arr = arr.filter((r) => (r.outstanding_interest || 0) > 0);

    if (sort === "recent")
      arr.sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
    if (sort === "name")
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sort === "outstanding")
      arr.sort((a, b) => (b.current_principal || 0) - (a.current_principal || 0));
    if (sort === "interest")
      arr.sort((a, b) => (b.outstanding_interest || 0) - (a.outstanding_interest || 0));
    return arr;
  }, [items, q, status, sort]);

  return (
    <>
      <div className="grid gap-4">
        <div className="card flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1"
              placeholder="Search name or contact…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex gap-2">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="interestDue">Interest Due</option>
                <option value="cleared">Cleared</option>
              </select>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="outstanding">Outstanding</option>
                <option value="interest">Interest</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Showing {filtered.length} / {items.length}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !filtered.length ? (
          <div className="text-sm text-slate-500">No records found.</div>
        ) : (
          filtered.map((row) => {
            const isOpen = !!open[row.id];
            const hasDues = Array.isArray(row.dues) && row.dues.length > 0;
            return (
              <motion.div key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-slate-500">
                      Start: {row.start_date}
                      {row.interest_rate ? ` • Rate: ${row.interest_rate}%` : ""}
                      {row.current_principal === 0 && " • Cleared ✅"}
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <button className="btn btn-ghost" onClick={() => openEdit(row)}>Edit</button>
                    {hasDues && (
                      <button className="btn btn-ghost" onClick={() => setOpen((m) => ({ ...m, [row.id]: !isOpen }))}>
                        {isOpen ? "Hide Dues" : `Dues (${row.dues.length})`}
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => topUp(row)}>Add Money</button>
                    <button className="btn btn-ghost" onClick={() => payInterest(row)}>Pay Interest (₹{fmt(row.current_ipm)})</button>
                    <button className="btn btn-ghost" onClick={() => payPrincipal(row)}>Pay Principal</button>
                    <button className="btn btn-ghost" disabled={row.current_principal > 0} onClick={() => remove(row)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="metrics">
                  <div className="metric">Outstanding Principal: <b>₹{fmt(row.current_principal)}</b></div>
                  <div className="metric">Accrued Interest: <b>₹{fmt(row.outstanding_interest)}</b></div>
                  <div className="metric">Interest / Month: <b>₹{fmt(row.current_ipm)}</b></div>
                  <div className="metric">Months Elapsed: <b>{row.months_elapsed}</b></div>
                </div>

                <div className="mt-3 sm:hidden grid grid-cols-2 gap-2">
                  <button className="btn btn-ghost" onClick={() => openEdit(row)}>Edit</button>
                  {hasDues && (
                    <button className="btn btn-ghost" onClick={() => setOpen((m) => ({ ...m, [row.id]: !isOpen }))}>
                      {isOpen ? "Hide Dues" : `Dues (${row.dues.length})`}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => payInterest(row)}>Interest ₹{fmt(row.current_ipm)}</button>
                  <button className="btn btn-ghost" onClick={() => payPrincipal(row)}>Principal</button>
                  <button className="btn btn-ghost" onClick={() => topUp(row)}>Add</button>
                  <button className="btn btn-ghost" disabled={row.current_principal > 0} onClick={() => remove(row)}>🗑</button>
                </div>

                {(hasDues || isOpen) && isOpen && (
                  <div className="mt-3 grid gap-4">
                    {hasDues && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Dues history</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {row.dues.map((d, i) => (
                            <div key={i} className="chip w-full flex items-start justify-between">
                              <div>
                                <div className="font-medium">{d.start_date} • ₹{fmt(d.amount)}</div>
                                {d.note && <div className="text-xs text-slate-500">{d.note}</div>}
                              </div>
                              <div className="text-right text-sm">
                                <div>IPM: ₹{fmt(d.interest_per_month)}</div>
                                <div className="text-xs text-slate-500">
                                  Now: ₹{fmt(d.current_ipm)} • Out: ₹{fmt(d.outstanding)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Payment history</div>
                      <PaymentHistory financeId={row.id} />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <EditFinanceModal
        open={editOpen}
        row={editRowData}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await load();
          onChanged?.();
        }}
      />
    </>
  );
}
