CREATE OR REPLACE FUNCTION app_private.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
  SELECT app_private.has_role(_user_id, 'admin')
    OR app_private.has_role(_user_id, 'gm')
    OR app_private.has_role(_user_id, 'office_coordinator')
    OR app_private.has_role(_user_id, 'accounting')
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND ur.role IN ('pm','site_manager','sales','estimator','installer','viewer')
    )
$function$;