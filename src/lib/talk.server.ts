/* The assistant talking, on the server: its answer is sent on as it's written, so the first words show on the phone
 * right away — not the whole answer at once, at the end. The same rules as askCompanyAI (lib/company-ai): only someone
 * the admin let in, and the key stays here. The app falls back to askCompanyAI if anything here doesn't work. */
import { createClient } from "@supabase/supabase-js";

/* fast, thinking only a little — the usual model if the gateway won't take it */
const FAST = { model: "google/gemini-3.5-flash", reasoning_effort: "minimal" };
const MODEL = "google/gemini-2.5-flash";
const GATEWAY = process.env["LOVABLE_AI_GATEWAY_URL"] || "https://ai.gateway.lovable.dev/v1/chat/completions";

/* who's on the team, remembered a few minutes — so a question doesn't wait on the database for it each time */
const TEAM = new Map<string, number>();
const TEAM_MS = 5 * 60_000;

const no = (why: string, status: number) =>
  new Response(JSON.stringify({ ok: false, why }), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/* the database as the person asking (their sign-in), like the server functions' check */
function asThem(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const opaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient(url, key, {
    global: {
      fetch: (input: any, init?: any) => {
        const h = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
        if (init?.headers) new Headers(init.headers).forEach((v, k) => h.set(k, v));
        if (opaque && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function onTeam(token: string): Promise<boolean> {
  const sb = asThem(token);
  if (!sb) return false;
  const { data, error } = await sb.auth.getClaims(token);
  const uid = !error && data?.claims?.sub ? String(data.claims.sub) : "";
  if (!uid) return false;
  const until = TEAM.get(uid);
  if (until && until > Date.now()) return true;
  const { data: roles } = await (sb as any).from("user_roles").select("role").eq("user_id", uid);
  if (!roles?.length) return false;
  TEAM.set(uid, Date.now() + TEAM_MS);
  return true;
}

export async function talk(request: Request): Promise<Response> {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token.split(".").length !== 3) return no("denied", 401);
  let prompt = "";
  try {
    const b: any = await request.json();
    prompt = typeof b?.prompt === "string" ? b.prompt : "";
  } catch { /* checked below */ }
  if (!prompt.trim() || prompt.length > 200_000) return no("error", 400);
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return no("nokey", 503);
  try {
    if (!(await onTeam(token))) return no("denied", 403);
  } catch {
    return no("denied", 403);
  }
  const call = (body: Record<string, unknown>) =>
    fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true, messages: [{ role: "user", content: prompt }] }),
    });
  let res: Response;
  try {
    res = await call(FAST);
    /* the fast model not taken (unknown, or its setting): the usual one */
    if (res.status === 400 || res.status === 404 || res.status === 422) res = await call({ model: MODEL });
  } catch {
    return no("error", 502);
  }
  if (res.status === 429) return no("busy", 429);
  if (res.status === 402) return no("credits", 402);
  if (!res.ok || !res.body) return no("error", 502);
  /* the gateway's stream (lines of "data: {…}") → just the words, as they come */
  const src = res.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  const out = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      for (;;) {
        const { done, value } = await src.read();
        if (done) {
          ctrl.close();
          return;
        }
        buf += dec.decode(value, { stream: true });
        let sent = false;
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          const d = line.slice(5).trim();
          if (!d || d === "[DONE]") continue;
          try {
            const t = JSON.parse(d)?.choices?.[0]?.delta?.content;
            if (typeof t === "string" && t) {
              ctrl.enqueue(enc.encode(t));
              sent = true;
            }
          } catch { /* not words (a ping): skip it */ }
        }
        if (sent) return;
      }
    },
    cancel() {
      src.cancel().catch(() => {});
    },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
