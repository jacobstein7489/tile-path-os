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

export type CompanyInput = {
  name: string;
  kind: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CompanyInput }) => {
      if (id) {
        const { error } = await supabase.from("companies").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase.from("companies").insert(values).select("*").single();
      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company saved");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Save failed"),
  });
}

export type ContactInput = {
  full_name: string;
  company_id?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  kind?: string;
  notes?: string | null;
  is_active?: boolean;
};

export function useSaveContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ContactInput }) => {
      if (id) {
        const { error } = await supabase.from("contacts").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data, error } = await supabase.from("contacts").insert(values).select("*").single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact saved");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Save failed"),
  });
}

export type ProfileInput = {
  full_name?: string;
  initials?: string;
  phone?: string | null;
  job_title?: string | null;
  avatar_tone?: string;
  default_route?: string;
  is_active?: boolean;
};

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, values }: { userId: string; values: ProfileInput }) => {
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
