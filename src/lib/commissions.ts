import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/data";

/* ============================================================
 * Commission management. Reusable plans are configured in Settings; the plan
 * applied to a job is snapshotted onto that job so later edits to a plan never
 * rewrite commissions that were already earned.
 * ============================================================ */

export const CALC_TYPES = [
  { value: "percent_contract", label: "Percentage of contract" },
  { value: "percent_gross_profit", label: "Percentage of gross profit" },
  { value: "fixed_amount", label: "Fixed amount" },
] as const;

export type CalcType = (typeof CALC_TYPES)[number]["value"];

export type CommissionPlan = {
  id: string;
  name: string;
  calc_type: CalcType;
  rate: number | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
};

export type PlanSnapshot = {
  plan_id: string | null;
  name: string;
  calc_type: CalcType;
  rate: number | null;
  applied_at: string;
};

export type CommissionPayment = {
  id: string;
  project_id: string;
  amount: number;
  paid_on: string;
  method: string | null;
  notes: string | null;
};

export const COMMISSION_STATUSES = ["Pending", "Approved", "Paid"] as const;

export function calcTypeLabel(t: string) {
  return CALC_TYPES.find((c) => c.value === t)?.label ?? t;
}

export function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function planDescription(plan: Pick<CommissionPlan, "calc_type" | "rate">) {
  if (plan.calc_type === "fixed_amount") return money(plan.rate);
  return plan.rate === null ? "Rate not set" : `${plan.rate}%`;
}

/** What the job earns, or null when the financial basis is not known yet. */
export function earnedFor(project: Project & { commission_plan_snapshot?: PlanSnapshot | null }) {
  const snap = project.commission_plan_snapshot;
  if (!snap) return null;
  if (snap.calc_type === "fixed_amount") return snap.rate ?? null;
  const basis = project.commissionable_amount ?? null;
  if (basis === null || snap.rate === null) return null;
  return Math.round((basis * snap.rate) / 100);
}

export function useCommissionPlans() {
  return useQuery({
    queryKey: ["commission_plans"],
    queryFn: async (): Promise<CommissionPlan[]> => {
      const { data, error } = await supabase
        .from("commission_plans")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommissionPlan[];
    },
  });
}

export type PlanInput = {
  name: string;
  calc_type: CalcType;
  rate: number | null;
  notes?: string | null;
  is_active?: boolean;
};

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PlanInput }) => {
      if (id) {
        const { error } = await supabase.from("commission_plans").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("commission_plans").insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["commission_plans"] });
      toast.success("Commission plan saved");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save plan"),
  });
}

export function useCommissionPayments() {
  return useQuery({
    queryKey: ["commission_payments"],
    queryFn: async (): Promise<CommissionPayment[]> => {
      const { data, error } = await supabase
        .from("commission_payments")
        .select("*")
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CommissionPayment[];
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      project_id: string;
      amount: number;
      paid_on: string;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from("commission_payments").insert(values);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["commission_payments"] });
      void qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Payment recorded");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save payment"),
  });
}

/** Applying a plan writes the snapshot — never just the plan id. */
export function snapshotOf(plan: CommissionPlan): PlanSnapshot {
  return {
    plan_id: plan.id,
    name: plan.name,
    calc_type: plan.calc_type,
    rate: plan.rate,
    applied_at: new Date().toISOString(),
  };
}
