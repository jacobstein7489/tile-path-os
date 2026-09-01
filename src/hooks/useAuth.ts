import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "gm"
  | "sales"
  | "estimator"
  | "pm"
  | "site_manager"
  | "office_coordinator"
  | "accounting"
  | "installer"
  | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  gm: "General Manager",
  sales: "Sales",
  estimator: "Estimator",
  pm: "Project Manager",
  site_manager: "Site Manager",
  office_coordinator: "Office Coordinator",
  accounting: "Accounting",
  installer: "Installer",
  viewer: "Viewer",
};

export type Profile = {
  user_id: string;
  full_name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  avatar_tone: string;
  default_route: string;
  is_active: boolean;
};

/** Current auth user (client-side session). */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { user, loading };
}

export function useMyProfile() {
  const { user } = useAuthUser();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

export function useMyRoles() {
  const { user } = useAuthUser();
  return useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

/** Permission helpers — mirror the database policies, never a substitute for them. */
export function usePermissions() {
  const { data: roles = [], isLoading } = useMyRoles();
  const has = (...check: AppRole[]) => check.some((r) => roles.includes(r));
  return {
    roles,
    isLoading,
    isAdmin: has("admin"),
    canAdminData: has("admin", "gm", "office_coordinator"),
    canManageProjects: has("admin", "gm", "office_coordinator", "pm", "sales"),
    canSeeMoney: has("admin", "gm", "accounting", "sales"),
    canRunField: has("admin", "gm", "pm", "site_manager"),
    has,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
