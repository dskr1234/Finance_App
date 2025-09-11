// just-finance/server/src/db.js
import mongoose from "mongoose";

export async function connectDB() {
  const url = process.env.MONGO_URI || "mongodb://localhost:27017/justfinance";
  await mongoose.connect(url, { dbName: "justfinance" });
  console.log("MongoDB connected:", url);
}

// --- Schemas ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  password_hash: String,
});

const dueSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    start_date: { type: Date, required: true },
    interest_per_month: { type: Number, required: true },
    note: { type: String },
    added_at: { type: Date, default: Date.now }
  },
  { _id: true }
);

const financeSchema = new mongoose.Schema({
  name: { type: String, index: true, required: true },
  contact: String,

  principal: { type: Number, required: true },
  interest_rate: { type: Number },         // annual % (nullable)
  interest_per_month: { type: Number },    // total IPM (nullable)

  start_date: { type: Date, default: Date.now },
  dues: { type: [dueSchema], default: [] },

  created_at: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  finance_id: { type: mongoose.Schema.Types.ObjectId, ref: "Finance", index: true },
  type: { type: String, enum: ["principal", "interest"], required: true },
  amount: { type: Number, required: true },
  paid_at: { type: Date, default: Date.now },
  note: String
});

export const User = mongoose.model("User", userSchema);
export const Finance = mongoose.model("Finance", financeSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
