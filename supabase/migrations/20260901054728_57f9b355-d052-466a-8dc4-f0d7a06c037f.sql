CREATE OR REPLACE FUNCTION app_private.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_private.is_company_operator(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND ur.role IN ('pm','sales')
    )
$$;

CREATE OR REPLACE FUNCTION public.assign_project_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN role = 'pm' THEN 'Project Manager'
    WHEN role = 'sales' THEN 'Salesperson'
    WHEN role = 'site_manager' THEN 'Site Manager'
    WHEN role = 'estimator' THEN 'Estimator'
    ELSE 'Creator'
  END
  INTO v_role
  FROM public.user_roles
  WHERE user_id = NEW.created_by
  ORDER BY CASE role
    WHEN 'pm' THEN 1 WHEN 'sales' THEN 2 WHEN 'site_manager' THEN 3 WHEN 'estimator' THEN 4 ELSE 5
  END
  LIMIT 1;

  INSERT INTO public.project_assignments (project_id, user_id, role_in_project)
  VALUES (NEW.id, NEW.created_by, COALESCE(v_role, 'Creator'))
  ON CONFLICT (project_id, user_id, role_in_project) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_project_creator ON public.projects;
CREATE TRIGGER trg_assign_project_creator
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.assign_project_creator();

REVOKE ALL ON FUNCTION public.assign_project_creator() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_project_creator() TO service_role;