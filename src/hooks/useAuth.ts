import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  default_commission_rate?: number;
};

/**
 * Current auth user. Backed by a single cached query keyed ["auth-user"] and read
 * from the LOCAL session — previously every component instance issued its own
 * network getUser() call, which made each route switch wait on the network.
 */
export function useAuthUser() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async (): Promise<User | null> => {
      const { data: session } = await supabase.auth.getSession();
      return session.session?.user ?? null;
    },
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      queryClient.setQueryData(["auth-user"], session?.user ?? null);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return { user: data ?? null, loading: isLoading };
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
        .eq("user_id", user?.id ?? "")
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
        .eq("user_id", user?.id ?? "");
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
    canManageUsers: has("admin"),
    canManageLibraries: has("admin", "gm", "office_coordinator"),
    canManageProjects: has("admin", "gm", "pm", "sales"),
    canSeeMoney: has("admin", "gm", "accounting", "sales"),
    canRunField: has("admin", "gm", "pm", "site_manager"),
    has,
  };
}

export function useCanEditProject(projectId: string) {
  const { user } = useAuthUser();
  const { data: roles = [], isLoading: rolesLoading } = useMyRoles();
  const assignment = useQuery({
    queryKey: ["my-project-assignment", projectId, user?.id],
    enabled: Boolean(user?.id && projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select("role_in_project")
        .eq("project_id", projectId)
        .eq("user_id", user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    canEdit:
      roles.includes("admin") ||
      roles.includes("gm") ||
      (roles.includes("pm") && assignment.data?.role_in_project === "pm"),
    isLoading: rolesLoading || assignment.isLoading,
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/auth";
}
