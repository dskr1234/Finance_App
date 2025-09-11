// just-finance/server/src/index.js
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB, User, Finance, Payment } from "./db.js";

await connectDB();

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

// ---- CORS ----
const envOrigins =
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  ...envOrigins
]);

const corsConfig = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // curl/health
    if (allowedOrigins.has(origin)) return cb(null, true);
    // allow *.vercel.app (preview) if you want
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return cb(null, true);
    return cb(new Error(`CORS not allowed for ${origin}`), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Passcode", "x-passcode"],
  credentials: true
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

// ---- Rate limit a bit ----
app.use("/api/", rateLimit({ windowMs: 60_000, max: 100 }));

// ---- Secrets ----
const JWT_SECRET = process.env.JWT_SECRET || "change-me";
const TX_PASSCODE = process.env.TX_PASSCODE || null;

// ---- Helpers ----
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
function requirePasscode(req, res, next) {
  if (!TX_PASSCODE) return res.status(500).json({ error: "TX_PASSCODE not set" });
  const code = (req.body && req.body.passcode) || req.headers["x-passcode"];
  if (!code || code !== TX_PASSCODE) return res.status(403).json({ error: "Invalid passcode" });
  next();
}
function monthsBetween(d1, d2) {
  const a = new Date(d1.getFullYear(), d1.getMonth(), 1);
  const b = new Date(d2.getFullYear(), d2.getMonth(), 1);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

// ---- Validation ----
const LoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

const FinanceSchema = z.object({
  name: z.string().min(2).max(120),
  contact: z.string().max(120).optional().default(""),
  amount: z.number().positive(),
  start_date: z.string().optional(),
  interest_per_month: z.number().min(0).optional(),
  interest_rate: z.number().min(0).max(100).optional()
}).refine(d => d.interest_per_month != null || d.interest_rate != null, {
  message: "Provide interest_per_month or interest_rate"
});

const PaymentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("principal"),
    amount: z.number().positive(),
    passcode: z.string().min(1),
    note: z.string().max(200).optional()
  }),
  z.object({
    type: z.literal("interest"),
    amount: z.number().positive().optional(),
    passcode: z.string().min(1),
    note: z.string().max(200).optional()
  })
]);

const TopUpSchema = z.object({
  amount: z.number().positive(),
  start_date: z.string().optional(),
  note: z.string().max(200).optional()
});

const EditFinanceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  contact: z.string().max(120).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  interest_rate: z.number().min(0).max(100).nullable().optional(),
  interest_per_month: z.number().min(0).nullable().optional()
}).refine(d => {
  const a = d.interest_rate !== undefined && d.interest_rate !== null;
  const b = d.interest_per_month !== undefined && d.interest_per_month !== null;
  return !(a && b);
}, { message: "Use either interest_rate OR interest_per_month (or clear one with null)" });

// ---- Domain helpers ----
function ensureDues(fin) {
  if (!Array.isArray(fin.dues) || fin.dues.length === 0) {
    fin.dues = [{
      amount: fin.principal,
      start_date: fin.start_date || new Date(),
      interest_per_month:
        Number(fin.interest_per_month || 0) ||
        (Number(fin.principal || 0) * Number(fin.interest_rate || 0)) / 100 / 12,
      note: "Initial",
      added_at: fin.start_date || new Date()
    }];
  }
}
function duesOutstanding(fin, totalPrincipalPaid) {
  const dues = [...fin.dues].sort((a,b)=> new Date(a.start_date)-new Date(b.start_date));
  let remainingPaid = Number(totalPrincipalPaid || 0);
  return dues.map(d => {
    const original = Number(d.amount || 0);
    const reduce = Math.min(original, Math.max(0, remainingPaid));
    remainingPaid -= reduce;
    return { original, remaining: original - reduce, due: d };
  });
}
function computeCurrentIPM(fin, duesState) {
  const rate = Number(fin.interest_rate || 0);
  if (rate > 0) {
    return duesState.reduce((s, x) => s + (x.remaining * rate) / 100 / 12, 0);
  }
  return duesState.reduce((s, x) => {
    const base = Number(x.due.interest_per_month || 0);
    const scale = x.original > 0 ? x.remaining / x.original : 0;
    return s + base * scale;
  }, 0);
}

// ---- Routes ----
app.get("/", (_req, res) => res.json({ service: "just-finance-api", ok: true }));

// Auth
app.post("/api/auth/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid" });
  const user = await User.findOne({ username: parsed.data.username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = bcrypt.compareSync(parsed.data.password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ sub: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// Create finance
app.post("/api/finance", auth, async (req, res) => {
  const parsed = FinanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const { name, contact = "", amount, start_date, interest_per_month, interest_rate } = parsed.data;
  const start = start_date ? new Date(start_date) : new Date();

  const ipm =
    interest_per_month != null
      ? Number(interest_per_month)
      : Math.max(0, (Number(amount) * Number(interest_rate || 0)) / 100 / 12);

  const doc = await Finance.create({
    name,
    contact,
    principal: amount,
    interest_rate: interest_rate ?? null,
    interest_per_month: ipm,
    start_date: start,
    dues: [{
      amount,
      start_date: start,
      interest_per_month: ipm,
      note: "Initial",
      added_at: start
    }]
  });

  res.json({ ok: true, id: doc._id });
});

// Edit finance
// ✏️ Edit finance (prioritize IPM if provided)
app.patch("/api/finance/:id", auth, async (req, res) => {
  const parsed = EditFinanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const fin = await Finance.findById(req.params.id);
  if (!fin) return res.status(404).json({ error: "Finance not found" });
  ensureDues(fin);

  const { name, contact, start_date, interest_rate, interest_per_month } = parsed.data;

  if (name !== undefined) fin.name = name;
  if (contact !== undefined) fin.contact = contact;

  // start_date also shifts earliest due
  if (start_date !== undefined) {
    const d = new Date(start_date);
    if (isNaN(+d)) return res.status(400).json({ error: "Invalid start_date" });
    fin.start_date = d;
    if (Array.isArray(fin.dues) && fin.dues.length) {
      let idx = 0;
      for (let i = 1; i < fin.dues.length; i++) {
        if (new Date(fin.dues[i].start_date) < new Date(fin.dues[idx].start_date)) idx = i;
      }
      fin.dues[idx].start_date = d;
    }
  }

  // IMPORTANT: prefer IPM branch if provided; otherwise use RATE branch
  if (interest_per_month !== undefined || interest_rate !== undefined) {
    const principalTotal = fin.dues.reduce((s, d) => s + Number(d.amount || 0), 0);

    if (interest_per_month !== undefined) {
      // Switch to flat IPM mode
      fin.interest_rate = null;
      if (interest_per_month !== null) {
        const total = Number(interest_per_month || 0);
        for (const d of fin.dues) {
          const share = principalTotal > 0 ? Number(d.amount || 0) / principalTotal : 0;
          d.interest_per_month = total * share;
        }
        fin.interest_per_month = total;
      } else {
        for (const d of fin.dues) d.interest_per_month = 0;
        fin.interest_per_month = 0;
      }
    } else if (interest_rate !== undefined) {
      // Switch to percentage mode
      fin.interest_rate = interest_rate; // may be null
      if (interest_rate !== null) {
        for (const d of fin.dues) d.interest_per_month = (Number(d.amount || 0) * interest_rate) / 100 / 12;
      } else {
        for (const d of fin.dues) d.interest_per_month = 0;
      }
      fin.interest_per_month = fin.dues.reduce((s, d) => s + Number(d.interest_per_month || 0), 0);
    }
  }

  await fin.save();
  res.json({ ok: true });
});


// Payments
app.post("/api/finance/:id/payments", auth, requirePasscode, async (req, res) => {
  const finance = await Finance.findById(req.params.id);
  if (!finance) return res.status(404).json({ error: "Finance not found" });
  ensureDues(finance);

  const parsed = PaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const sums = await Payment.aggregate([
    { $match: { finance_id: finance._id } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } }
  ]);
  const sumBy = Object.fromEntries(sums.map(s => [s._id, s.total]));
  const paid_principal = sumBy.principal || 0;
  const paid_interest  = sumBy.interest  || 0;

  const duesState = duesOutstanding(finance, paid_principal);

  let amount = parsed.data.amount;

  if (parsed.data.type === "principal") {
    const current_principal = duesState.reduce((s, x) => s + x.remaining, 0);
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (amount > current_principal) return res.status(400).json({ error: "Amount exceeds outstanding principal" });
  } else if (parsed.data.type === "interest") {
    const now = new Date();
    const accrued = finance.dues.reduce((s, d) => {
      const m = monthsBetween(d.start_date, now);
      return s + m * Number(d.interest_per_month || 0);
    }, 0);
    const maxOutstanding = Math.max(0, accrued - paid_interest);

    if (!amount || amount <= 0) amount = maxOutstanding;
    if (amount < 1) return res.status(400).json({ error: "Interest amount must be at least ₹1" });
    if (amount > maxOutstanding)
      return res.status(400).json({ error: `Max interest due is ₹${Math.round(maxOutstanding)}` });
  }

  const pay = await Payment.create({
    finance_id: finance._id,
    type: parsed.data.type,
    amount,
    note: parsed.data.note || ""
  });

  res.json({ ok: true, payment_id: pay._id, amount });
});

// List finances (+derived fields)
app.get("/api/finance", auth, async (_req, res) => {
  const rows = await Finance.find().sort({ created_at: -1 });

  const ids = rows.map(r => r._id);
  const pays = await Payment.aggregate([
    { $match: { finance_id: { $in: ids } } },
    { $group: { _id: { fid: "$finance_id", type: "$type" }, sum: { $sum: "$amount" } } }
  ]);
  const bucket = {};
  for (const p of pays) {
    const k = p._id.fid.toString();
    bucket[k] = bucket[k] || { principal: 0, interest: 0 };
    bucket[k][p._id.type] = p.sum;
  }

  const now = new Date();

  const mapped = rows.map((r) => {
    ensureDues(r);
    const k = r._id.toString();
    const paid_principal = bucket[k]?.principal || 0;
    const paid_interest  = bucket[k]?.interest  || 0;

    const duesState = duesOutstanding(r, paid_principal);
    const current_principal = duesState.reduce((s,x)=> s + x.remaining, 0);
    const current_ipm_total = computeCurrentIPM(r, duesState);

    const accrued = r.dues.reduce((s, d) => {
      const m = monthsBetween(d.start_date, now);
      return s + m * Number(d.interest_per_month || 0);
    }, 0);
    const outstanding_interest = Math.max(0, accrued - paid_interest);

    const dues = r.dues
      .sort((a,b)=> new Date(a.start_date) - new Date(b.start_date))
      .map((d, i) => {
        const st = duesState[i];
        const rate = Number(r.interest_rate || 0);
        const cur_ipm = rate > 0
          ? (st.remaining * rate) / 100 / 12
          : (st.original > 0 ? (d.interest_per_month * st.remaining) / st.original : 0);
        return {
          amount: d.amount,
          start_date: d.start_date.toISOString().slice(0,10),
          interest_per_month: Math.round(d.interest_per_month),
          outstanding: Math.round(st.remaining),
          current_ipm: Math.round(cur_ipm),
          note: d.note || ""
        };
      });

    return {
      id: k,
      name: r.name,
      contact: r.contact,
      amount: r.principal,
      interest_rate: r.interest_rate,
      interest_per_month: r.interest_per_month,
      start_date: r.start_date.toISOString().slice(0, 10),
      paid_principal, paid_interest,
      current_principal,
      current_ipm: Math.round(current_ipm_total),
      months_elapsed: monthsBetween(r.start_date, new Date()),
      outstanding_interest: Math.round(outstanding_interest),
      dues,
      outstanding: current_principal
    };
  });

  res.json({ items: mapped });
});

// Payment history
app.get("/api/finance/:id/payments", auth, async (req, res) => {
  const pays = await Payment.find({ finance_id: req.params.id }).sort({ paid_at: -1 });
  const formatted = pays.map(p => ({
    id: p._id.toString(),
    type: p.type,
    amount: p.amount,
    note: p.note || "",
    date: p.paid_at.toISOString().slice(0,10)
  }));
  res.json({ items: formatted });
});

// Summary
app.get("/api/summary", auth, async (_req, res) => {
  const aggP = await Finance.aggregate([{ $group: { _id: null, total: { $sum: "$principal" } } }]);
  const paid = await Payment.aggregate([
    { $match: { type: "principal" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const total_principal = aggP[0]?.total || 0;
  const total_outstanding = Math.max(0, total_principal - (paid[0]?.total || 0));
  res.json({ total_principal, total_outstanding });
});

// Top-up
app.patch("/api/finance/:id/topup", auth, async (req, res) => {
  const parsed = TopUpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });

  const finance = await Finance.findById(req.params.id);
  if (!finance) return res.status(404).json({ error: "Finance not found" });
  ensureDues(finance);

  const add = Number(parsed.data.amount);
  if (!Number.isFinite(add) || add <= 0) return res.status(400).json({ error: "Invalid amount" });

  const sd = parsed.data.start_date ? new Date(parsed.data.start_date) : new Date();

  let ipmForNew = 0;
  if (finance.interest_rate != null) {
    ipmForNew = (add * Number(finance.interest_rate)) / 100 / 12;
  } else {
    const totalPrincipal = finance.dues.reduce((s,d)=> s + Number(d.amount||0), 0);
    const totalIPM       = finance.dues.reduce((s,d)=> s + Number(d.interest_per_month||0), 0);
    const effRate = totalPrincipal > 0 ? (totalIPM * 12 * 100) / totalPrincipal : 0; // %
    ipmForNew = (effRate / 100) * add / 12;
  }

  finance.dues.push({
    amount: add,
    start_date: sd,
    interest_per_month: Math.round(ipmForNew),
    note: parsed.data.note || "Top-up",
    added_at: new Date()
  });

  finance.principal = Number(finance.principal || 0) + add;
  finance.interest_per_month = finance.dues.reduce((s,d)=> s + Number(d.interest_per_month||0), 0);

  await finance.save();

  res.json({
    ok: true,
    id: finance._id,
    principal: finance.principal,
    interest_per_month: finance.interest_per_month,
    interest_rate: finance.interest_rate
  });
});

// Errors
app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith("CORS not allowed")) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// Boot
async function maybeSeedAdmin() {
  const mode =
    process.env.AUTO_SEED_ADMIN === "true" ? "bootstrap"
    : process.env.ADMIN_UPSERT_ON_BOOT === "true" ? "upsert"
    : null;

  if (!mode) return;
  const username = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASS || "change-me-123";
  const hash = bcrypt.hashSync(password, 10);

  if (mode === "bootstrap") {
    const count = await User.countDocuments();
    if (count === 0) await User.create({ username, password_hash: hash });
  } else {
    await User.updateOne({ username }, { username, password_hash: hash }, { upsert: true });
  }
}
await maybeSeedAdmin();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Just Finance API running on :${PORT}`));
