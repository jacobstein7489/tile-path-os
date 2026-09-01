CREATE OR REPLACE FUNCTION public.is_company_operator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','gm','office_coordinator')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_company_operator(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND ur.role IN ('pm','site_manager','sales','estimator','installer','viewer')
    )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_company_operator(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND ur.role IN ('pm')
    )
$$;

CREATE OR REPLACE FUNCTION public.can_field_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_edit_project(_user_id, _project_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_assignments pa
      JOIN public.user_roles ur ON ur.user_id = pa.user_id
      WHERE pa.project_id = _project_id
        AND pa.user_id = _user_id
        AND ur.role IN ('site_manager','installer')
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_project_path(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  v_project_id := split_part(_path, '/', 1)::uuid;
  RETURN public.can_access_project(_user_id, v_project_id);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_access_project(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_edit_project(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_field_project(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_access_project_path(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_field_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_project_path(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_initials text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));
  v_initials := upper(left(coalesce(split_part(v_name,' ',1),'?'),1) || coalesce(left(nullif(split_part(v_name,' ',2),''),1),''));
  INSERT INTO public.profiles (user_id, full_name, initials, email)
  VALUES (NEW.id, v_name, NULLIF(v_initials,''), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM pg_advisory_xact_lock(hashtext('cobblestone:first-administrator'));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.project_areas ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.project_surfaces ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.material_items ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname = 'public' AND tablename IN (
      'profiles','user_roles','companies','contacts','crews','projects','project_assignments',
      'project_participants','project_areas','project_surfaces','work_items','work_item_events',
      'material_items','material_receipts','purchase_orders','po_lines','schedule_assignments',
      'visit_checklist_items','project_files'
    )) OR (schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%project-files%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY "Approved staff read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_staff(auth.uid()));
CREATE POLICY "Administrators update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Approved staff read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Administrators manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Approved staff read companies" ON public.companies
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Company operators create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators update companies" ON public.companies
  FOR UPDATE TO authenticated USING (public.is_company_operator(auth.uid())) WITH CHECK (public.is_company_operator(auth.uid()));

CREATE POLICY "Approved staff read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Company operators create contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators update contacts" ON public.contacts
  FOR UPDATE TO authenticated USING (public.is_company_operator(auth.uid())) WITH CHECK (public.is_company_operator(auth.uid()));

CREATE POLICY "Approved staff read crews" ON public.crews
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Company operators create crews" ON public.crews
  FOR INSERT TO authenticated WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators update crews" ON public.crews
  FOR UPDATE TO authenticated USING (public.is_company_operator(auth.uid())) WITH CHECK (public.is_company_operator(auth.uid()));

CREATE POLICY "Authorized users read projects" ON public.projects
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), id));
CREATE POLICY "Authorized users create projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (
    public.is_company_operator(auth.uid()) OR public.has_role(auth.uid(),'sales')
  );
CREATE POLICY "Authorized users update projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), id)) WITH CHECK (public.can_edit_project(auth.uid(), id));
CREATE POLICY "Administrators permanently delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authorized users read project assignments" ON public.project_assignments
  FOR SELECT TO authenticated USING (
    public.is_company_operator(auth.uid()) OR user_id = auth.uid() OR public.can_access_project(auth.uid(), project_id)
  );
CREATE POLICY "Company operators create project assignments" ON public.project_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators update project assignments" ON public.project_assignments
  FOR UPDATE TO authenticated USING (public.is_company_operator(auth.uid())) WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators remove project assignments" ON public.project_assignments
  FOR DELETE TO authenticated USING (public.is_company_operator(auth.uid()));

CREATE POLICY "Authorized users read project participants" ON public.project_participants
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create project participants" ON public.project_participants
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update project participants" ON public.project_participants
  FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read areas" ON public.project_areas
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create areas" ON public.project_areas
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update areas" ON public.project_areas
  FOR UPDATE TO authenticated USING (public.can_field_project(auth.uid(), project_id)) WITH CHECK (public.can_field_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read surfaces" ON public.project_surfaces
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.project_areas a WHERE a.id = area_id AND public.can_access_project(auth.uid(), a.project_id))
  );
CREATE POLICY "Authorized users create surfaces" ON public.project_surfaces
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_areas a WHERE a.id = area_id AND public.can_edit_project(auth.uid(), a.project_id))
  );
CREATE POLICY "Authorized users update surfaces" ON public.project_surfaces
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project_areas a WHERE a.id = area_id AND public.can_field_project(auth.uid(), a.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project_areas a WHERE a.id = area_id AND public.can_field_project(auth.uid(), a.project_id)));

CREATE POLICY "Authorized users read work items" ON public.work_items
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create work items" ON public.work_items
  FOR INSERT TO authenticated WITH CHECK (public.can_field_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update work items" ON public.work_items
  FOR UPDATE TO authenticated USING (public.can_field_project(auth.uid(), project_id)) WITH CHECK (public.can_field_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read work history" ON public.work_item_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.work_items w WHERE w.id = work_item_id AND public.can_access_project(auth.uid(), w.project_id))
  );
CREATE POLICY "Authorized users append work history" ON public.work_item_events
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.work_items w WHERE w.id = work_item_id AND public.can_field_project(auth.uid(), w.project_id))
  );

CREATE POLICY "Authorized users read materials" ON public.material_items
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create materials" ON public.material_items
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update materials" ON public.material_items
  FOR UPDATE TO authenticated USING (public.can_field_project(auth.uid(), project_id)) WITH CHECK (public.can_field_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read receipts" ON public.material_receipts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.material_items m WHERE m.id = material_item_id AND public.can_access_project(auth.uid(), m.project_id))
  );
CREATE POLICY "Authorized users append receipts" ON public.material_receipts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.material_items m WHERE m.id = material_item_id AND public.can_field_project(auth.uid(), m.project_id))
  );

CREATE POLICY "Authorized users read purchase orders" ON public.purchase_orders
  FOR SELECT TO authenticated USING (project_id IS NOT NULL AND public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create purchase orders" ON public.purchase_orders
  FOR INSERT TO authenticated WITH CHECK (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update purchase orders" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read PO lines" ON public.po_lines
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND public.can_access_project(auth.uid(), po.project_id))
  );
CREATE POLICY "Authorized users create PO lines" ON public.po_lines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND public.can_edit_project(auth.uid(), po.project_id))
  );
CREATE POLICY "Authorized users update PO lines" ON public.po_lines
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND public.can_edit_project(auth.uid(), po.project_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_id AND po.project_id IS NOT NULL AND public.can_edit_project(auth.uid(), po.project_id)));

CREATE POLICY "Authorized users read schedule" ON public.schedule_assignments
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Company operators create schedule" ON public.schedule_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_company_operator(auth.uid()));
CREATE POLICY "Company operators update schedule" ON public.schedule_assignments
  FOR UPDATE TO authenticated USING (public.is_company_operator(auth.uid())) WITH CHECK (public.is_company_operator(auth.uid()));

CREATE POLICY "Authorized users read visit checklist" ON public.visit_checklist_items
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users create visit checklist" ON public.visit_checklist_items
  FOR INSERT TO authenticated WITH CHECK (public.can_field_project(auth.uid(), project_id));
CREATE POLICY "Authorized users update visit checklist" ON public.visit_checklist_items
  FOR UPDATE TO authenticated USING (public.can_field_project(auth.uid(), project_id)) WITH CHECK (public.can_field_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read project files" ON public.project_files
  FOR SELECT TO authenticated USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "Authorized users register project files" ON public.project_files
  FOR INSERT TO authenticated WITH CHECK (public.can_field_project(auth.uid(), project_id) AND uploaded_by = auth.uid());
CREATE POLICY "Authorized users update project files" ON public.project_files
  FOR UPDATE TO authenticated USING (public.can_edit_project(auth.uid(), project_id)) WITH CHECK (public.can_edit_project(auth.uid(), project_id));

CREATE POLICY "Authorized users read project-files objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND public.can_access_project_path(auth.uid(), name));
CREATE POLICY "Authorized users upload project-files objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.can_access_project_path(auth.uid(), name));
CREATE POLICY "Authorized users update project-files objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND public.can_edit_project(auth.uid(), split_part(name, '/', 1)::uuid))
  WITH CHECK (bucket_id = 'project-files' AND public.can_edit_project(auth.uid(), split_part(name, '/', 1)::uuid));
