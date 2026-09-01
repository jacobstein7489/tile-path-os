import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum([
    "admin",
    "gm",
    "sales",
    "estimator",
    "pm",
    "site_manager",
    "office_coordinator",
    "accounting",
    "installer",
    "viewer",
  ]),
});

export const inviteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = roles?.some(({ role }) => role === "admin");
    if (roleError || !allowed) throw new Error("Only Administrators can invite employees.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = process.env["APP_ORIGIN"] ?? "";
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      ...(origin ? { redirectTo: `${origin}/auth` } : {}),
    });
    if (error) throw new Error(error.message);
    const userId = invited.user?.id;
    if (!userId) throw new Error("The employee invitation could not be created.");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, is_active: true })
      .eq("user_id", userId);
    if (profileError) throw new Error(profileError.message);

    const { error: grantError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role" });
    if (grantError) throw new Error(grantError.message);
    return { ok: true };
  });
