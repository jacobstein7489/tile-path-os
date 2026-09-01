import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile } from "@/hooks/useAuth";
import type { ComboOption } from "@/components/kit";

export type Company = {
  id: string;
  name: string;
  kind: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
};

export type Contact = {
  id: string;
  company_id: string | null;
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  kind: string;
  notes: string | null;
  is_active: boolean;
};

export const COMPANY_KINDS = [
  "customer",
  "gc",
  "designer",
  "supplier",
  "tile_store",
  "installer",
  "trade",
  "other",
] as const;

export const COMPANY_KIND_LABELS: Record<string, string> = {
  customer: "Customer",
  gc: "General Contractor",
  designer: "Designer / Architect",
  supplier: "Supplier",
  tile_store: "Tile Store",
  installer: "Installer",
  trade: "Other Trade",
  other: "Other",
};

/* ---------------- Queries ---------------- */

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async (): Promise<{ id: string; user_id: string; role: AppRole }[]> => {
      const { data, error } = await supabase.from("user_roles").select("id,user_id,role");
      if (error) throw error;
      return (data ?? []) as { id: string; user_id: string; role: AppRole }[];
    },
  });
}

export function useCompanies(kind?: string) {
  return useQuery({
    queryKey: ["companies", kind ?? "all"],
    queryFn: async (): Promise<Company[]> => {
      let q = supabase.from("companies").select("*").order("name", { ascending: true });
      if (kind) q = q.eq("kind", kind);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });
}

export function useContacts(companyId?: string | null) {
  return useQuery({
    queryKey: ["contacts", companyId ?? "all"],
    queryFn: async (): Promise<Contact[]> => {
      let q = supabase.from("contacts").select("*").order("full_name", { ascending: true });
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}

/* ---------------- Mutations ---------------- */

function useTableMutation<T extends Record<string, unknown>>(
  table: "companies" | "contacts" | "user_roles" | "profiles" | "project_assignments",
  invalidate: string[],
  successMessage: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; values: T; remove?: boolean }) => {
      if (payload.remove && payload.id) {
        const { error } = await supabase.from(table).delete().eq("id", payload.id);
        if (error) throw error;
        return;
      }
      if (payload.id) {
        const { error } = await supabase.from(table).update(payload.values).eq("id", payload.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from(table).insert(payload.values);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate.forEach((key) => void qc.invalidateQueries({ queryKey: [key] }));
      toast.success(successMessage);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Save failed");
    },
  });
}

export function useSaveCompany() {
  return useTableMutation<Record<string, unknown>>("companies", ["companies"], "Company saved");
}

export function useSaveContact() {
  return useTableMutation<Record<string, unknown>>("contacts", ["contacts"], "Contact saved");
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, values }: { userId: string; values: Record<string, unknown> }) => {
      const { error } = await supabase.from("profiles").update(values).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profiles"] });
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Save failed"),
  });
}

export function useToggleRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
      grant,
    }: {
      userId: string;
      role: AppRole;
      grant: boolean;
    }) => {
      if (grant) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-roles"] });
      void qc.invalidateQueries({ queryKey: ["my-roles"] });
      toast.success("Roles updated");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not update roles"),
  });
}

/* ---------------- Selector option builders ---------------- */

export function profileOptions(profiles: Profile[]): ComboOption[] {
  return profiles
    .filter((p) => p.is_active)
    .map((p) => ({
      value: p.user_id,
      label: p.full_name || p.email || "Unnamed user",
      ...(p.job_title ? { hint: p.job_title } : {}),
    }));
}

export function companyOptions(companies: Company[], kind?: string): ComboOption[] {
  return companies
    .filter((c) => c.is_active && (!kind || c.kind === kind))
    .map((c) => ({
      value: c.id,
      label: c.name,
      hint: COMPANY_KIND_LABELS[c.kind] ?? c.kind,
    }));
}

export function contactOptions(contacts: Contact[], companies: Company[]): ComboOption[] {
  const byId = new Map(companies.map((c) => [c.id, c.name]));
  return contacts
    .filter((c) => c.is_active)
    .map((c) => {
      const hint = [c.title, c.company_id ? byId.get(c.company_id) : null]
        .filter(Boolean)
        .join(" · ");
      return { value: c.id, label: c.full_name, ...(hint ? { hint } : {}) };
    });
}
