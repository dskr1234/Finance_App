// just-finance/client/src/pages/Login.jsx
import React, { useState } from "react";
import { api, setToken } from "../api";
import { motion } from "framer-motion";
import Tilt3D from "../components/Tilt3D";
import GlassBG from "../components/GlassBG";
// in Login.jsx
import InstallAppButton from "../components/InstallAppButton.jsx";


export default function Login({ onLogin }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [focused, setFocused] = useState(false);
  const [showPW, setShowPW] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      onLogin?.();
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <GlassBG />
      <Tilt3D className="w-full max-w-lg" disabled={focused || busy}>
        <div className="card">
          <motion.h1 className="text-2xl font-extrabold mb-6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            Likesh Reddy Finance — Admin
          </motion.h1>

          {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}

          <form
            onSubmit={submit}
            className="grid gap-5"
            autoComplete="on"
            onFocus={() => setFocused(true)}
            onBlur={(e) => {
              const next = e.relatedTarget;
              if (!next || !e.currentTarget.contains(next)) setFocused(false);
            }}
          >
            <div className="flex items-center justify-between">
              <InstallAppButton className="btn btn-ghost sm:btn" />
            </div>

            <div>
              <div className="label">Username</div>
              <input
                className="input"
                value={username}
                onChange={(e) => setU(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                disabled={busy}
              />
            </div>

            <div>
              <div className="label">Password</div>
              <div className="relative">
                <input
                  className="input pr-12"
                  type={showPW ? "text" : "password"}
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPW((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-700"
                  aria-label={showPW ? "Hide password" : "Show password"}
                >
                  {showPW ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <motion.button type="submit" whileTap={{ scale: 0.98 }} className="btn btn-primary w-full" disabled={busy}>
              {busy ? "Signing in..." : "Login"}
            </motion.button>
          </form>
        </div>
      </Tilt3D>
    </div>
  );
}
