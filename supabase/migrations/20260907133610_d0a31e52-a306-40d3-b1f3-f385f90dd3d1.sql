-- Commission plans configured by management in Settings.
CREATE TABLE public.commission_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  calc_type text NOT NULL CHECK (calc_type IN ('percent_contract','percent_gross_profit','fixed_amount')),
  rate numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_plans TO authenticated;
GRANT ALL ON public.commission_plans TO service_role;
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_plans_read_staff" ON public.commission_plans
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "commission_plans_insert_mgmt" ON public.commission_plans
  FOR INSERT TO authenticated WITH CHECK (public.can_admin_data(auth.uid()));
CREATE POLICY "commission_plans_update_mgmt" ON public.commission_plans
  FOR UPDATE TO authenticated USING (public.can_admin_data(auth.uid()))
  WITH CHECK (public.can_admin_data(auth.uid()));

CREATE TRIGGER trg_commission_plans_updated BEFORE UPDATE ON public.commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Snapshot of the plan applied to a project, so later Settings edits never
-- rewrite historical commissions.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS commission_plan_id uuid REFERENCES public.commission_plans(id),
  ADD COLUMN IF NOT EXISTS commission_plan_snapshot jsonb;

-- Payments recorded against a project commission.
CREATE TABLE public.commission_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_on date NOT NULL DEFAULT current_date,
  method text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payments TO authenticated;
GRANT ALL ON public.commission_payments TO service_role;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_payments_read_mgmt" ON public.commission_payments
  FOR SELECT TO authenticated USING (public.can_admin_data(auth.uid()));
CREATE POLICY "commission_payments_insert_mgmt" ON public.commission_payments
  FOR INSERT TO authenticated WITH CHECK (public.can_admin_data(auth.uid()));
CREATE POLICY "commission_payments_update_mgmt" ON public.commission_payments
  FOR UPDATE TO authenticated USING (public.can_admin_data(auth.uid()))
  WITH CHECK (public.can_admin_data(auth.uid()));

CREATE INDEX IF NOT EXISTS commission_payments_project_idx ON public.commission_payments(project_id);
