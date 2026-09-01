ALTER FUNCTION public.has_role(uuid, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.is_staff(uuid) SECURITY INVOKER;
ALTER FUNCTION public.can_admin_data(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_company_operator(uuid) SECURITY INVOKER;
ALTER FUNCTION public.can_access_project(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.can_edit_project(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.can_field_project(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.can_access_project_path(uuid, text) SECURITY INVOKER;