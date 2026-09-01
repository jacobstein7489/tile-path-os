-- ============ 1. ROLES ============
CREATE TYPE public.app_role AS ENUM (
  'admin','gm','sales','estimator','pm','site_manager','office_coordinator','accounting','installer','viewer'
);

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  initials text NOT NULL DEFAULT '',
  email text,
  phone text,
  job_title text,
  avatar_tone text NOT NULL DEFAULT 'blue',
  default_route text NOT NULL DEFAULT '/dashboard',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_admin_data(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','gm','office_coordinator')
  )
$$;

CREATE POLICY "Signed-in users read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Signed-in users read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Safe bootstrap: profile on sign-up; first ever user becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_initials text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));
  v_initials := upper(left(coalesce(split_part(v_name,' ',1),'?'),1) || coalesce(left(nullif(split_part(v_name,' ',2),''),1),''));
  INSERT INTO public.profiles (user_id, full_name, initials, email)
  VALUES (NEW.id, v_name, NULLIF(v_initials,''), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 2. COMPANIES + CONTACTS ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'customer',
  phone text,
  email text,
  address text,
  website text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read companies" ON public.companies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Data admins write companies" ON public.companies
  FOR ALL TO authenticated USING (public.can_admin_data(auth.uid())) WITH CHECK (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  title text,
  phone text,
  email text,
  kind text NOT NULL DEFAULT 'other',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Data admins write contacts" ON public.contacts
  FOR ALL TO authenticated USING (public.can_admin_data(auth.uid())) WITH CHECK (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_contacts_company ON public.contacts(company_id);

-- ============ 3. PROJECT TEAM ============
CREATE TABLE public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_in_project text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, role_in_project)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assignments TO authenticated;
GRANT ALL ON public.project_assignments TO service_role;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read project assignments" ON public.project_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Data admins write project assignments" ON public.project_assignments
  FOR ALL TO authenticated USING (public.can_admin_data(auth.uid())) WITH CHECK (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_project_assignments_updated BEFORE UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_project_assignments_project ON public.project_assignments(project_id);

CREATE TABLE public.project_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  role_in_project text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_participants TO authenticated;
GRANT ALL ON public.project_participants TO service_role;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read project participants" ON public.project_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Data admins write project participants" ON public.project_participants
  FOR ALL TO authenticated USING (public.can_admin_data(auth.uid())) WITH CHECK (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_project_participants_updated BEFORE UPDATE ON public.project_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_project_participants_project ON public.project_participants(project_id);

-- ============ 4. PROJECT INTAKE + IDENTITY (legacy columns retained, untouched) ============
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS job_number text,
  ADD COLUMN IF NOT EXISTS customer_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gc_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_user_id uuid,
  ADD COLUMN IF NOT EXISTS site_manager_user_id uuid,
  ADD COLUMN IF NOT EXISTS salesperson_user_id uuid,
  ADD COLUMN IF NOT EXISTS estimator_user_id uuid,
  ADD COLUMN IF NOT EXISTS commission_user_id uuid,
  ADD COLUMN IF NOT EXISTS commission_rule_ref text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS bid_due_date date,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS awarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS intake_notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

COMMENT ON COLUMN public.projects.customer IS 'DEPRECATED Sprint 1: use customer_company_id. Retained read-only for rollback.';
COMMENT ON COLUMN public.projects.project_manager IS 'DEPRECATED Sprint 1: use pm_user_id. Retained read-only for rollback.';
COMMENT ON COLUMN public.projects.crew_lead IS 'DEPRECATED Sprint 1: use site_manager_user_id / crew refs. Retained read-only for rollback.';

-- ============ 5. CREW DETAIL ============
ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_user_id uuid,
  ADD COLUMN IF NOT EXISTS capacity_per_day numeric,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;