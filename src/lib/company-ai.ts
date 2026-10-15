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
