CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.has_role(_user_id, _role) $$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.is_staff(_user_id) $$;
CREATE OR REPLACE FUNCTION public.can_admin_data(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.can_admin_data(_user_id) $$;
CREATE OR REPLACE FUNCTION public.is_company_operator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.is_company_operator(_user_id) $$;
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.can_access_project(_user_id, _project_id) $$;
CREATE OR REPLACE FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.can_edit_project(_user_id, _project_id) $$;
CREATE OR REPLACE FUNCTION public.can_field_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.can_field_project(_user_id, _project_id) $$;
CREATE OR REPLACE FUNCTION public.can_access_project_path(_user_id uuid, _path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app_private
AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND app_private.can_access_project_path(_user_id, _path) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_admin_data(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_project(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_project(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_field_project(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_project_path(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_admin_data(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_field_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project_path(uuid, text) TO authenticated, service_role;