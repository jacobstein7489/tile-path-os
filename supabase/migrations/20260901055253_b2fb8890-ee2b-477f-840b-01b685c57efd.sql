CREATE OR REPLACE FUNCTION app_private.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT app_private.has_role(_user_id, 'admin')
    OR app_private.has_role(_user_id, 'gm')
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND pa.role_in_project = 'pm'
        AND ur.role = 'pm'
    )
$$;

CREATE OR REPLACE FUNCTION app_private.can_manage_project_materials(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT app_private.has_role(_user_id, 'admin')
    OR app_private.has_role(_user_id, 'gm')
    OR app_private.has_role(_user_id, 'office_coordinator')
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND pa.role_in_project = 'pm'
        AND ur.role = 'pm'
    )
$$;

REVOKE ALL ON FUNCTION app_private.can_manage_project_materials(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.can_manage_project_materials(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authorized users create materials" ON public.material_items;
DROP POLICY IF EXISTS "Authorized users update materials" ON public.material_items;
CREATE POLICY "Authorized users create materials" ON public.material_items
  FOR INSERT TO authenticated WITH CHECK (app_private.can_manage_project_materials(auth.uid(), project_id));
CREATE POLICY "Authorized users update materials" ON public.material_items
  FOR UPDATE TO authenticated USING (app_private.can_manage_project_materials(auth.uid(), project_id)) WITH CHECK (app_private.can_manage_project_materials(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authorized users append receipts" ON public.material_receipts;
CREATE POLICY "Authorized users append receipts" ON public.material_receipts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.material_items m WHERE m.id = material_item_id AND app_private.can_manage_project_materials(auth.uid(), m.project_id))
  );

DROP POLICY IF EXISTS "Authorized users create purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Authorized users update purchase orders" ON public.purchase_orders;
CREATE POLICY "Authorized users create purchase orders" ON public.purchase_orders
  FOR INSERT TO authenticated WITH CHECK (project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), project_id));
CREATE POLICY "Authorized users update purchase orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), project_id))
  WITH CHECK (project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authorized users create PO lines" ON public.po_lines;
DROP POLICY IF EXISTS "Authorized users update PO lines" ON public.po_lines;
CREATE POLICY "Authorized users create PO lines" ON public.po_lines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), po.project_id))
  );
CREATE POLICY "Authorized users update PO lines" ON public.po_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), po.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND app_private.can_manage_project_materials(auth.uid(), po.project_id)));

DROP POLICY IF EXISTS "Authorized users upload project-files objects" ON storage.objects;
CREATE POLICY "Authorized users upload project-files objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND app_private.can_field_project(auth.uid(), split_part(name, '/', 1)::uuid)
  );