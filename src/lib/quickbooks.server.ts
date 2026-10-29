/* QuickBooks Online, on the server only: the company's connection (kept in a table no browser can read), signing in
 * with Intuit, and every call to QuickBooks. Tokens never leave the server.
 *
 * Keys come from Lovable → More → Settings → Secrets: QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET (the
 * Production keys of the "Tile OS" app on developer.intuit.com). QUICKBOOKS_ENVIRONMENT=sandbox points it at a test
 * company instead. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TABLE = "tileos_quickbooks";
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";
/** the API version every call asks for */
export const MINOR = "75";

export class QbError extends Error {
  why: string;
  constructor(why: string, msg: string) {
    super(msg);
    this.why = why;
  }
}

export const qbKeys = () => ({ id: (process.env["QUICKBOOKS_CLIENT_ID"] || "").trim(), secret: (process.env["QUICKBOOKS_CLIENT_SECRET"] || "").trim() });
export const qbConfigured = () => !!(qbKeys().id && qbKeys().secret);
export const qbEnv = (): "sandbox" | "production" => ((process.env["QUICKBOOKS_ENVIRONMENT"] || "").toLowerCase().startsWith("sand") ? "sandbox" : "production");
const apiBase = () => (qbEnv() === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com");
/** where Intuit sends the admin back after he says yes — it has to be on the app's list in the Intuit app exactly */
export const redirectUri = (origin: string) => (process.env["QUICKBOOKS_REDIRECT_URI"] || "").trim() || `${origin.replace(/\/$/, "")}/api/quickbooks/callback`;

export type Conn = {
  id: string;
  realm_id?: string | null;
  company?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  access_expires?: string | null;
  refresh_expires?: string | null;
  env?: string | null;
  state?: string | null;
  state_expires?: string | null;
  origin?: string | null;
  connected_at?: string | null;
  connected_by?: string | null;
  updated_at?: string | null;
};
const table = () => (supabaseAdmin as any).from(TABLE);
export async function readConn(): Promise<Conn | null> {
  const { data, error } = await table().select("*").eq("id", "main").maybeSingle();
  if (error) throw new QbError(/does not exist|relation|schema cache/i.test(error.message || "") ? "notable" : "db", error.message || "Couldn’t read the connection");
  return data || null;
}
export async function writeConn(patch: Partial<Conn>) {
  const { error } = await table().upsert({ id: "main", ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new QbError(/does not exist|relation|schema cache/i.test(error.message || "") ? "notable" : "db", error.message || "Couldn’t save the connection");
}
export async function dropConn() {
  await table().delete().eq("id", "main");
}

const basic = () => {
  const k = qbKeys();
  return "Basic " + btoa(`${k.id}:${k.secret}`);
};
async function tokenCall(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body).toString(),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new QbError(j.error === "invalid_grant" ? "reconnect" : "auth", j.error_description || j.error || `Intuit said ${res.status}`);
  return j as { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in?: number };
}
const expiries = (j: { expires_in: number; x_refresh_token_expires_in?: number }) => {
  const now = Date.now();
  return {
    access_expires: new Date(now + Math.max(60, (j.expires_in || 3600) - 120) * 1000).toISOString(),
    refresh_expires: new Date(now + (j.x_refresh_token_expires_in || 100 * 86400) * 1000).toISOString(),
  };
};

/** a random one-time word that ties Intuit's answer to the admin who asked */
export function newState() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
export function authorizeUrl(origin: string, state: string) {
  const q = new URLSearchParams({ client_id: qbKeys().id, response_type: "code", scope: SCOPE, redirect_uri: redirectUri(origin), state });
  return `${AUTH_URL}?${q.toString()}`;
}
/** Intuit said yes: trade its code for the company's tokens and keep them (with the company's name) */
export async function exchangeCode(origin: string, code: string, realmId: string) {
  const j = await tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
  await writeConn({ realm_id: realmId, access_token: j.access_token, refresh_token: j.refresh_token, ...expiries(j), env: qbEnv(), state: null, state_expires: null, connected_at: new Date().toISOString() });
  try {
    const info = await api("GET", `/companyinfo/${encodeURIComponent(realmId)}`);
    await writeConn({ company: info?.CompanyInfo?.CompanyName || info?.CompanyInfo?.LegalName || null });
  } catch {
    /* the name is only for the screen */
  }
}
async function fresh(): Promise<{ token: string; realm: string }> {
  const c = await readConn();
  if (!c?.refresh_token || !c.realm_id) throw new QbError("notconnected", "QuickBooks isn’t connected yet");
  if (c.access_token && c.access_expires && Date.parse(c.access_expires) > Date.now()) return { token: c.access_token, realm: c.realm_id };
  const j = await tokenCall({ grant_type: "refresh_token", refresh_token: c.refresh_token });
  /* Intuit can hand back a new refresh token — the newest one is the only one that works next time */
  await writeConn({ access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, ...expiries(j) });
  return { token: j.access_token, realm: c.realm_id };
}

/** one call to QuickBooks' accounting API */
export async function api(method: "GET" | "POST", path: string, body?: unknown, o: { query?: Record<string, string>; pdf?: boolean; contentType?: string } = {}): Promise<any> {
  const { token, realm } = await fresh();
  const q = new URLSearchParams({ minorversion: MINOR, ...(o.query || {}) });
  const url = `${apiBase()}/v3/company/${encodeURIComponent(realm)}${path}?${q.toString()}`;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: o.pdf ? "application/pdf" : "application/json" };
  if (body !== undefined) headers["Content-Type"] = o.contentType || "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  if (res.status === 401) throw new QbError("reconnect", "QuickBooks needs you to connect it again (Settings → Connections)");
  if (o.pdf) {
    if (!res.ok) throw new QbError("api", `QuickBooks said ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j.Fault) {
    const e = j.Fault?.Error?.[0];
    throw new QbError(e?.code === "5010" ? "stale" : "api", e ? `${e.Message || "QuickBooks said no"}${e.Detail ? ` — ${e.Detail}` : ""}` : `QuickBooks said ${res.status}`);
  }
  return j;
}
/** QuickBooks' own query words: SELECT * FROM Customer WHERE DisplayName = '…' */
export async function query(sql: string): Promise<any> {
  return (await api("GET", "/query", undefined, { query: { query: sql } })).QueryResponse || {};
}
export const quote = (v: string) => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export async function revoke() {
  const c = await readConn().catch(() => null);
  if (!c?.refresh_token) return;
  await fetch(REVOKE_URL, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token: c.refresh_token }) }).catch(() => null);
}

/** bytes → base64, in pieces (a big PDF in one go overflows the call stack) */
export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
