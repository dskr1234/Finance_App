import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/db.js";

const { MONGO_URI } = process.env;
if (!MONGO_URI) throw new Error("MONGO_URI missing");

await mongoose.connect(MONGO_URI, { dbName: "justfinance" });

const username = process.env.ADMIN_USER || "admin";
const password = process.env.ADMIN_PASS || "change-me-123";

const password_hash = bcrypt.hashSync(password, 10);
const existing = await User.findOne({ username });
if (existing) {
  console.log("User already exists:", username);
} else {
  await User.create({ username, password_hash });
  console.log("Admin created:", username, "password:", password);
}

await mongoose.disconnect();
