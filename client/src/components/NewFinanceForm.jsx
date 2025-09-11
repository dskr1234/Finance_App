import React, { useState } from "react";
import { api } from "../api";
import { motion } from "framer-motion";

export default function NewFinanceForm({ onCreated }) {
  const [form, setForm] = useState({
    name: "", contact: "", amount: "", interest_per_month: "", start_date: ""
  });
  const [busy, setBusy] = useState(false);
  const on = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try{
      await api.createFinance({
        name: form.name,
        contact: form.contact,
        amount: Number(form.amount || 0),
        interest_per_month: Number(form.interest_per_month || 0),
        start_date: form.start_date || undefined
      });
      setForm({ name: "", contact: "", amount: "", interest_per_month: "", start_date: "" });
      onCreated?.();
    }catch(ex){ alert(ex.message); }finally{ setBusy(false); }
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <h2 className="text-[var(--h2)] font-semibold mb-4">New Finance</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-muted">Name</label>
          <input className="input" placeholder="Borrower name"
                 value={form.name} onChange={e=>on("name", e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-muted">Contact</label>
          <input className="input" placeholder="Phone / Note"
                 inputMode="tel"
                 value={form.contact} onChange={e=>on("contact", e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted">Amount (₹)</label>
          <input className="input" type="text" inputMode="decimal" pattern="[0-9]*"
                 value={form.amount} onChange={e=>on("amount", e.target.value)} required />
        </div>
        <div>
          <label className="text-sm text-muted">Interest per Month (₹)</label>
          <input className="input" type="text" inputMode="decimal" pattern="[0-9]*"
                 value={form.interest_per_month} onChange={e=>on("interest_per_month", e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm text-muted">Start Date (optional)</label>
          <input className="input" type="date"
                 value={form.start_date} onChange={e=>on("start_date", e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Save Finance"}
        </button>
      </div>
    </motion.form>
  );
}
