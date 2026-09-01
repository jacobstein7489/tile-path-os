DROP POLICY IF EXISTS "Administrators can read bootstrap state" ON public.application_bootstrap;
CREATE POLICY "Administrators can read bootstrap state"
ON public.application_bootstrap FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'admin'));