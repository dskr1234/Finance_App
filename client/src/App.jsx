// just-finance/client/src/App.jsx
import React, { useEffect, useState } from "react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { getToken, clearToken } from "./api.js";
import { motion, AnimatePresence } from "framer-motion";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err, info){ console.error("App crashed:", err, info); }
  render(){
    if (this.state.err) {
      return (
        <div style={{ padding: 24 }}>
          <h1>⚠️ UI error</h1>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.err.stack || this.state.err)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    try { return !!getToken(); } catch { return false; }
  });

  useEffect(() => {
    const onStorage = (e) => { if (e.key === "token") setAuthed(!!getToken()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen app-bg">
        <AnimatePresence mode="wait">
          {authed ? (
            <motion.div key="dash" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: "easeOut" }}>
              <Dashboard onLogout={() => { clearToken(); setAuthed(false); }} />
            </motion.div>
          ) : (
            <motion.div key="login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: "easeOut" }}>
              <Login onLogin={() => setAuthed(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
