import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

// yyyy-mm-dd check
const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());

// robust number parser: accepts "1,000", trims spaces; returns kind + value
const parseNumber = (v) => {
  if (v === "" || v === null || v === undefined) return { kind: "empty" };
  const n = Number(String(v).replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return { kind: "invalid" };
  return { kind: "num", value: n };
};

export default function EditFinanceModal({ open, row, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [startDate, setStartDate] = useState("");
  const [mode, setMode] = useState("rate"); // 'rate' | 'ipm'
  const [rate, setRate] = useState("");     // %
  const [ipm, setIpm] = useState("");       // ₹/month
  const [saving, setSaving] = useState(false);

  // preload fields from selected row
  useEffect(() => {
    if (!open || !row) return;
    setName(row.name || "");
    setContact(row.contact || "");
    setStartDate(row.start_date || "");
    if (row?.interest_rate != null) {
      setMode("rate");
      setRate(String(row.interest_rate));
      setIpm("");
    } else {
      setMode("ipm");
      const v = row?.interest_per_month != null ? row.interest_per_month : row?.current_ipm;
      setIpm(v != null ? String(v) : "");
      setRate("");
    }
  }, [open, row]);

  const canSave = useMemo(() => {
    if (!row) return false;
    if (!name || name.trim().length < 2) return false;
    if (startDate && !isYYYYMMDD(startDate)) return false;

    if (mode === "rate") {
      const p = parseNumber(rate);
      return p.kind === "empty" || (p.kind === "num" && p.value >= 0 && p.value <= 100);
    } else {
      const p = parseNumber(ipm);
      return p.kind === "empty" || (p.kind === "num" && p.value >= 0);
    }
  }, [row, name, startDate, mode, rate, ipm]);

  async function save() {
    if (!row) return;
    if (!canSave) return alert("Please fix the fields and try again.");

    // Build minimal PATCH payload with only changed fields
    const payload = {};

    if (name !== row.name) payload.name = name;
    if ((contact || "") !== (row.contact || "")) payload.contact = contact || "";

    if (startDate && startDate !== row.start_date) {
      if (!isYYYYMMDD(startDate)) return alert("Start date must be YYYY-MM-DD");
      payload.start_date = startDate;
    }

    if (mode === "rate") {
      const p = parseNumber(rate);
      if (p.kind === "invalid") return alert("Rate must be a number between 0 and 100");
      if (p.kind === "empty") {
        // explicit clear — only include the field we’re editing
        payload.interest_rate = null;
      } else {
        if (p.value < 0 || p.value > 100) return alert("Rate must be 0–100");
        payload.interest_rate = p.value;
      }
      // DO NOT send interest_per_month at all in rate mode
    } else {
      const p = parseNumber(ipm);
      if (p.kind === "invalid") return alert("Interest per month must be a valid number (e.g. 1500 or 1,500)");
      if (p.kind === "empty") {
        payload.interest_per_month = null;
      } else {
        if (p.value < 0) return alert("Interest per month must be ≥ 0");
        payload.interest_per_month = p.value;
      }
      // DO NOT send interest_rate at all in IPM mode
    }

    if (Object.keys(payload).length === 0) {
      onClose?.();
      return;
    }

    try {
      setSaving(true);
      await api.editFinance(row.id, payload);
      await onSaved?.();
      onClose?.();
    } catch (ex) {
      alert(ex.message || "Edit failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xl">
        <div className="text-lg font-semibold">Edit Finance</div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Name</span>
            <input className="input" value={name} onChange={(e)=>setName(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Contact</span>
            <input className="input" value={contact} onChange={(e)=>setContact(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-500">Start Date (YYYY-MM-DD)</span>
            <input
              className="input"
              type="date"
              value={startDate || ""}
              onChange={(e)=>setStartDate(e.target.value)}
            />
          </label>

          <div className="grid gap-2">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={`chip ${mode==='rate'?'ring-2 ring-violet-500':''}`}
                onClick={()=>setMode('rate')}
              >
                Rate %
              </button>
              <button
                type="button"
                className={`chip ${mode==='ipm'?'ring-2 ring-violet-500':''}`}
                onClick={()=>setMode('ipm')}
              >
                Interest / Month
              </button>
            </div>

            {mode === "rate" ? (
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">
                  Annual Rate (%) — leave empty to clear
                </span>
                <input
                  className="input"
                  type="text"   // allow "1, 1.25, 1,25"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e)=>setRate(e.target.value)}
                  placeholder="e.g. 18"
                />
              </label>
            ) : (
              <label className="grid gap-1">
                <span className="text-xs text-slate-500">
                  Interest per Month (₹) — leave empty to clear
                </span>
                <input
                  className="input"
                  type="text"   // allow "1,500"
                  inputMode="numeric"
                  value={ipm}
                  onChange={(e)=>setIpm(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button className="btn btn-ghost" onClick={()=>onClose?.()} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
