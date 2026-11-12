/* The company's AI, on the server: it reads pages (pictures of paperwork) and answers a question about them.
 * It runs on Lovable AI — the key stays on the server, and only someone the admin has let in can ask. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ask = { prompt: string; pages: string[] };
export type Answer =
  | { ok: true; text: string }
  | { ok: false; why: "nokey" | "busy" | "credits" | "denied" | "error"; detail?: string };

/* reads pictures and tables well, and quickly */
const MODEL = "google/gemini-2.5-flash";
const GATEWAY = process.env["LOVABLE_AI_GATEWAY_URL"] || "https://ai.gateway.lovable.dev/v1/chat/completions";

export const askCompanyAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Ask) => {
    if (!d || typeof d.prompt !== "string" || !d.prompt.trim() || d.prompt.length > 200_000) throw new Error("Bad question");
    if (!Array.isArray(d.pages) || d.pages.length > 10) throw new Error("Too many pages");
    if (d.pages.some((p) => typeof p !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(p))) throw new Error("Pages must be pictures");
    return d;
  })
  .handler(async ({ data, context }): Promise<Answer> => {
    /* only the team: someone the admin let in has a role */
    const { data: roles } = await (context.supabase as any).from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.length) return { ok: false, why: "denied" };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, why: "nokey" };
    let res: Response;
    try {
      res = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: data.prompt }, ...data.pages.map((url) => ({ type: "image_url", image_url: { url } }))],
            },
          ],
        }),
      });
    } catch (e: any) {
      return { ok: false, why: "error", detail: String(e?.message || e).slice(0, 300) };
    }
    if (res.status === 429) return { ok: false, why: "busy" };
    if (res.status === 402) return { ok: false, why: "credits" };
    if (!res.ok) return { ok: false, why: "error", detail: `${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}` };
    const j: any = await res.json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? { ok: true, text } : { ok: false, why: "error", detail: "empty answer" };
  });

/* ---------------- hearing: a recording, written down ----------------
 * When the browser can't listen (an iPhone's home-screen app, a browser whose listening is off), the app records and
 * this writes it down. The gateway's transcribing models first, then Gemini, which hears audio too — the first that
 * answers. The hint is the names and words likely to come up (the team, the projects), so they're spelled right. */
type Hear = { audio: string; hint?: string };
export type Heard = { ok: true; text: string; via: string } | { ok: false; why: "nokey" | "busy" | "credits" | "denied" | "error"; detail?: string };
const BASE = GATEWAY.replace(/\/chat\/completions\/?$/, "");
const HEARERS = ["openai/gpt-4o-transcribe", "openai/gpt-4o-mini-transcribe", "openai/gpt-transcribe"];

export const hearCompanyAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Hear) => {
    if (!d || typeof d.audio !== "string" || d.audio.length < 100 || d.audio.length > 12_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(d.audio.slice(-200))) throw new Error("Bad recording");
    return { audio: d.audio, hint: typeof d.hint === "string" ? d.hint.slice(0, 800) : "" };
  })
  .handler(async ({ data, context }): Promise<Heard> => {
    const { data: roles } = await (context.supabase as any).from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.length) return { ok: false, why: "denied" };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, why: "nokey" };
    const bin = atob(data.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const tried: string[] = [];
    for (const model of HEARERS) {
      try {
        const fd = new FormData();
        fd.append("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
        fd.append("model", model);
        fd.append("language", "en");
        fd.append("response_format", "json");
        if (data.hint) fd.append("prompt", data.hint);
        const r = await fetch(`${BASE}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Lovable-API-Key": key }, body: fd });
        if (r.status === 429) return { ok: false, why: "busy" };
        if (r.status === 402) return { ok: false, why: "credits" };
        if (r.ok) {
          const j: any = await r.json().catch(() => null);
          if (typeof j?.text === "string") return { ok: true, text: j.text.trim(), via: model };
        }
        tried.push(`${model} ${r.status}`);
      } catch (e: any) {
        tried.push(`${model} ${String(e?.message || e).slice(0, 80)}`);
      }
    }
    /* Gemini hears too: the recording with the question */
    try {
      const ask = `Write down exactly what is said in this recording — only the words, in the language spoken. No quotes, no notes, no timestamps. If nothing is said, answer with nothing.${data.hint ? ` Names and words that may come up: ${data.hint}` : ""}`;
      const r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: [{ type: "text", text: ask }, { type: "input_audio", input_audio: { data: data.audio, format: "wav" } }] }] }),
      });
      if (r.status === 429) return { ok: false, why: "busy" };
      if (r.status === 402) return { ok: false, why: "credits" };
      if (r.ok) {
        const j: any = await r.json().catch(() => null);
        const text = j?.choices?.[0]?.message?.content;
        if (typeof text === "string") return { ok: true, text: text.trim(), via: MODEL };
      }
      tried.push(`${MODEL} ${r.status} ${(await r.text().catch(() => "")).slice(0, 160)}`);
    } catch (e: any) {
      tried.push(`${MODEL} ${String(e?.message || e).slice(0, 80)}`);
    }
    return { ok: false, why: "error", detail: tried.join(" · ").slice(0, 500) };
  });
