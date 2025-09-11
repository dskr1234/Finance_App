/* smart API base that works on desktop, mobile, LAN, and prod */

const pickBase = () => {
  // 1) explicit runtime override (great for quick mobile tests)
  try {
    const override = localStorage.getItem("api_base");
    if (override) return override.replace(/\/+$/, "");
  } catch {}

  // 2) .env value wins in prod/previews
  const envBase = (import.meta.env.VITE_API_BASE || "").trim();
  if (envBase) return envBase.replace(/\/+$/, "");

  // 3) infer from location for dev/LAN
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    // localhost dev → talk to local API
    if (/^(localhost|127\.0\.0\.1|::1)$/.test(hostname)) {
      return "http://localhost:4000";
    }

    // LAN dev (open client via 192.168.x.x or 10.x.x.x) → assume API on same host:4000
    const isPrivateIP =
      /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(hostname) || /\.local$/.test(hostname);
    if (isPrivateIP) return `${protocol}//${hostname}:4000`;
  }

  // 4) same-origin (relative) — works when you reverse-proxy /api in prod
  return ""; // empty means use relative paths
};

export let BASE = pickBase(); // exported + mutable

// quick helpers to adjust at runtime if needed
export function setBase(url) {
  BASE = (url || "").replace(/\/+$/, "");
  try {
    if (BASE) localStorage.setItem("api_base", BASE);
    else localStorage.removeItem("api_base");
  } catch {}
  console.info("[API] base set to:", BASE || "(relative)");
}
export function clearBase() { setBase(""); }

// --- auth token handling ---
let token = "";
export function getToken() {
  try {
    const t = localStorage.getItem("token");
    if (t !== null) token = t;
  } catch {}
  return token || "";
}
export function setToken(t) {
  token = t || "";
  try { localStorage.setItem("token", token); } catch {}
}
export function clearToken() {
  token = "";
  try { localStorage.removeItem("token"); } catch {}
}

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...extra,
  };
}

async function asJson(res) {
  const text = await res.text();
  try { return JSON.parse(text || "{}"); } catch { return text; }
}

function buildUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return BASE ? `${BASE}${p}` : p; // same-origin when BASE == ""
}

/** fetch with small timeout & nicer offline errors */
async function req(method, path, body, extraHeaders) {
  const url = buildUrl(path);

  // nice offline message when PWA is installed or connection drops
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You appear to be offline. Please reconnect and try again.");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000); // 15s
  let res, data;
  try {
    res = await fetch(url, {
      method,
      headers: headers(extraHeaders),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: "omit",
    });
    data = await asJson(res);
  } catch (e) {
    clearTimeout(t);
    if (e.name === "AbortError") throw new Error("Network timeout. Please try again.");
    throw new Error(e?.message || "Network error");
  }
  clearTimeout(t);

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" ? data : `Request failed (${res.status})`);
    throw new Error(msg);
  }
  return data;
}

// Optional helper for passcode header
const withPass = (passcode) => (passcode ? { "X-Passcode": passcode } : {});

// ---- Public API ----
export const api = {
  // auth
  login: (username, password) => req("POST", "/api/auth/login", { username, password }),

  // finance core
  createFinance: (payload) => req("POST", "/api/finance", payload),
  listFinance: () => req("GET", "/api/finance"),
  summary: () => req("GET", "/api/summary"),

  payInterest: (id, passcode, amount) =>
    req("POST", `/api/finance/${id}/payments`, { type: "interest", amount, passcode }),

  payPrincipal: (id, amount, passcode) =>
    req("POST", `/api/finance/${id}/payments`, { type: "principal", amount, passcode }),

  topUpFinance: (id, amount) => req("PATCH", `/api/finance/${id}/topup`, { amount }),
  editFinance: (id, payload) => req("PATCH", `/api/finance/${id}`, payload),

  deleteFinance: (id, passcode) =>
    req("DELETE", `/api/finance/${id}`, null, withPass(passcode)),

  // history
  getPayments: (id) => req("GET", `/api/finance/${id}/payments`),

  // runtime config
  setBase,
  clearBase,
};

// visibility in console
console.log("[API] BASE =", BASE || "(relative)");
