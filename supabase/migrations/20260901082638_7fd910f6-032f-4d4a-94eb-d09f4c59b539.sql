DROP POLICY "Authorized users read work items" ON public.work_items;
DROP POLICY "Authorized users create work items" ON public.work_items;
DROP POLICY "Authorized users update work items" ON public.work_items;

CREATE POLICY "Authorized users read work items" ON public.work_items
FOR SELECT TO authenticated
USING (
  (project_id IS NULL AND app_private.is_staff(auth.uid()))
  OR app_private.can_access_project(auth.uid(), project_id)
);

CREATE POLICY "Authorized users create work items" ON public.work_items
FOR INSERT TO authenticated
WITH CHECK (
  (project_id IS NULL AND app_private.is_staff(auth.uid()))
  OR app_private.can_field_project(auth.uid(), project_id)
);

CREATE POLICY "Authorized users update work items" ON public.work_items
FOR UPDATE TO authenticated
USING (
  (project_id IS NULL AND app_private.is_staff(auth.uid()))
  OR app_private.can_field_project(auth.uid(), project_id)
)
WITH CHECK (
  (project_id IS NULL AND app_private.is_staff(auth.uid()))
  OR app_private.can_field_project(auth.uid(), project_id)
);