CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public, anon, authenticated;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA app_private;
ALTER FUNCTION public.is_staff(uuid) SET SCHEMA app_private;
ALTER FUNCTION public.can_admin_data(uuid) SET SCHEMA app_private;
ALTER FUNCTION public.is_company_operator(uuid) SET SCHEMA app_private;
ALTER FUNCTION public.can_access_project(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.can_edit_project(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.can_field_project(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.can_access_project_path(uuid, text) SET SCHEMA app_private;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated, service_role;