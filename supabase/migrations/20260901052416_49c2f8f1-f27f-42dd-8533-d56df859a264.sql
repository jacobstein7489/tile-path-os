-- 1. project_files
CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  surface_id uuid REFERENCES public.project_surfaces(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text NOT NULL DEFAULT 'other',
  caption text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read project files" ON public.project_files
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff upload project files" ON public.project_files
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update project files" ON public.project_files
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Data admins delete project files" ON public.project_files
  FOR DELETE TO authenticated USING (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_project_files_updated BEFORE UPDATE ON public.project_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_project_files_project ON public.project_files(project_id);

-- 2. storage policies for the private bucket
CREATE POLICY "Staff read project-files objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff write project-files objects" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff update project-files objects" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-files' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'project-files' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff delete project-files objects" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND public.can_admin_data(auth.uid()));

-- 3. RLS cutover step 1: projects, areas, surfaces, work items
DROP POLICY IF EXISTS "Open access to projects" ON public.projects;
CREATE POLICY "Staff read projects" ON public.projects
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write projects" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update projects" ON public.projects
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Data admins delete projects" ON public.projects
  FOR DELETE TO authenticated USING (public.can_admin_data(auth.uid()));
REVOKE ALL ON public.projects FROM anon;

DROP POLICY IF EXISTS "Open access to areas" ON public.project_areas;
CREATE POLICY "Staff manage areas" ON public.project_areas
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.project_areas FROM anon;

DROP POLICY IF EXISTS "Open access to surfaces" ON public.project_surfaces;
CREATE POLICY "Staff manage surfaces" ON public.project_surfaces
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.project_surfaces FROM anon;

DROP POLICY IF EXISTS "Open access to work items" ON public.work_items;
CREATE POLICY "Staff manage work items" ON public.work_items
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
REVOKE ALL ON public.work_items FROM anon;