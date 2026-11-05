/**
 * Tiny client for the BitSecure FastAPI backend.
 * Set window.BITSECURE_API_URL before this loads to point somewhere else.
 */
const API_BASE = window.BITSECURE_API_URL ??
  (["localhost", "127.0.0.1"].includes(location.hostname) ? "http://localhost:8001" : "");
const TOKEN_KEY = "bitsecure.token";

export class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message);
    this.status = status;
    this.data = data; // parsed JSON body of the error response, if any
  }
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** "Remember me" keeps the token across browser restarts; otherwise it lasts for the tab only. */
export function setToken(token, remember) {
  clearToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {}
}

async function request(path, { method = "GET", body, auth = false, keepalive = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    if (typeof data?.detail === "string") msg = data.detail;
    else if (Array.isArray(data?.detail)) {
      const field = data.detail[0]?.loc?.slice(-1)[0];
      msg = field === "password" ? "Password must be 8–128 characters." : "Please enter a valid email address.";
    }
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

export const register = (email, password, remember) =>
  request("/auth/register", { method: "POST", body: { email, password, remember } });

export const login = (email, password, remember) =>
  request("/auth/login", { method: "POST", body: { email, password, remember } });

export const fetchMe = () => request("/api/me", { auth: true });

/** For future features (progress, routing): authenticated JSON request. */
export const authedRequest = (path, opts = {}) => request(path, { ...opts, auth: true });

/**
 * POST JSON and read the response as newline-delimited JSON, calling onLine(obj) for each line as it arrives.
 * Used by Live route, where hops stream in while the server is still tracing.
 */
export async function streamNdjson(path, body, onLine, signal) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_BASE + path, { method: "POST", headers, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    const detail = data?.detail;
    throw new ApiError(res.status, typeof detail === "string" ? detail : "The request could not be completed.", data);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const text = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      let obj = null;
      try { obj = text ? JSON.parse(text) : null; } catch {}
      if (obj) onLine(obj);
    }
  }
}
