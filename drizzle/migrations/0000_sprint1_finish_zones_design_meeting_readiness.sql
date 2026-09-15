-- ===== 1. Surface becomes the physical object (additive) =====
ALTER TABLE public.project_surfaces
  ADD COLUMN IF NOT EXISTS surface_kind text,
  ADD COLUMN IF NOT EXISTS uom text,
  ADD COLUMN IF NOT EXISTS measured_length_in numeric,
  ADD COLUMN IF NOT EXISTS measured_width_in numeric,
  ADD COLUMN IF NOT EXISTS measured_height_in numeric,
  ADD COLUMN IF NOT EXISTS geometry_ref jsonb,
  ADD COLUMN IF NOT EXISTS features jsonb;

-- ===== 2. Room keeps a lightweight plan reference =====
ALTER TABLE public.project_areas
  ADD COLUMN IF NOT EXISTS plan_file_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_page integer,
  ADD COLUMN IF NOT EXISTS plan_location jsonb;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS readiness_computed_at timestamptz;

-- ===== 3. finish_selection: project-level reusable PRODUCT specification =====
CREATE TABLE public.finish_selection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  tile_tag text,
  product text,
  manufacturer text,
  tile_sku text,
  tile_size text,
  actual_size text,
  tile_finish text,
  supplier text,
  supplied_by text,
  product_meta jsonb,
  spec_status text NOT NULL DEFAULT 'Draft',
  revision_no integer NOT NULL DEFAULT 1,
  confirmed_at timestamptz,
  confirmed_by uuid,
  notes text,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finish_selection TO authenticated;
GRANT ALL ON public.finish_selection TO service_role;
ALTER TABLE public.finish_selection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finish_selection read" ON public.finish_selection FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "finish_selection insert" ON public.finish_selection FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "finish_selection update" ON public.finish_selection FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_finish_selection_updated BEFORE UPDATE ON public.finish_selection
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_finish_selection_project ON public.finish_selection(project_id);

-- ===== 4. finish_zone: belongs to exactly one surface =====
CREATE TABLE public.finish_zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  surface_id uuid NOT NULL REFERENCES public.project_surfaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Main',
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  measurement jsonb,
  geometry_ref jsonb,
  zone_offset jsonb,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finish_zone TO authenticated;
GRANT ALL ON public.finish_zone TO service_role;
ALTER TABLE public.finish_zone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finish_zone read" ON public.finish_zone FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "finish_zone insert" ON public.finish_zone FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "finish_zone update" ON public.finish_zone FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_finish_zone_updated BEFORE UPDATE ON public.finish_zone
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_finish_zone_surface ON public.finish_zone(surface_id);
CREATE UNIQUE INDEX idx_finish_zone_one_default ON public.finish_zone(surface_id) WHERE is_default;

-- ===== 5. finish_assignment: zone-specific effective installation spec =====
CREATE TABLE public.finish_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.finish_zone(id) ON DELETE CASCADE,
  finish_selection_id uuid REFERENCES public.finish_selection(id) ON DELETE SET NULL,
  grout_manufacturer text,
  grout_color text,
  joint_size text,
  metal_profile text,
  edge_treatment text,
  layout_pattern text,
  layout_direction text,
  start_point text,
  tile_height text,
  finish_transition text,
  coverage text,
  sort_order integer NOT NULL DEFAULT 0,
  spec_status text NOT NULL DEFAULT 'Draft',
  confirmed_at timestamptz,
  confirmed_by uuid,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finish_assignment TO authenticated;
GRANT ALL ON public.finish_assignment TO service_role;
ALTER TABLE public.finish_assignment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finish_assignment read" ON public.finish_assignment FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "finish_assignment insert" ON public.finish_assignment FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "finish_assignment update" ON public.finish_assignment FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_finish_assignment_updated BEFORE UPDATE ON public.finish_assignment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_finish_assignment_zone ON public.finish_assignment(zone_id);
CREATE INDEX idx_finish_assignment_selection ON public.finish_assignment(finish_selection_id);

-- ===== 6. Question rules (data-driven, allowlisted targets) =====
CREATE TABLE public.question_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  prompt text NOT NULL,
  help_text text,
  scope text NOT NULL DEFAULT 'zone',
  applies_to_surface_types text[] NOT NULL DEFAULT '{}',
  applies_when jsonb,
  answer_type text NOT NULL DEFAULT 'text',
  options jsonb,
  target_key text NOT NULL,
  required_for_readiness boolean NOT NULL DEFAULT true,
  readiness_category text NOT NULL DEFAULT 'Design decisions',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.question_rule TO authenticated;
GRANT ALL ON public.question_rule TO service_role;
ALTER TABLE public.question_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_rule read" ON public.question_rule FOR SELECT TO authenticated USING (true);
CREATE POLICY "question_rule admin write" ON public.question_rule FOR ALL TO authenticated
  USING (public.can_admin_data(auth.uid())) WITH CHECK (public.can_admin_data(auth.uid()));
CREATE TRIGGER trg_question_rule_updated BEFORE UPDATE ON public.question_rule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== 7. Design meeting =====
CREATE TABLE public.design_meeting_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.design_meeting_session TO authenticated;
GRANT ALL ON public.design_meeting_session TO service_role;
ALTER TABLE public.design_meeting_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dms read" ON public.design_meeting_session FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "dms insert" ON public.design_meeting_session FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "dms update" ON public.design_meeting_session FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_dms_updated BEFORE UPDATE ON public.design_meeting_session
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.design_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.design_meeting_session(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  surface_id uuid REFERENCES public.project_surfaces(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.finish_zone(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  prompt text,
  answer_value text,
  status text NOT NULL DEFAULT 'unresolved',
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.design_decision TO authenticated;
GRANT ALL ON public.design_decision TO service_role;
ALTER TABLE public.design_decision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "design_decision read" ON public.design_decision FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "design_decision insert" ON public.design_decision FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "design_decision update" ON public.design_decision FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_design_decision_updated BEFORE UPDATE ON public.design_decision
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX idx_design_decision_identity
  ON public.design_decision(project_id, question_key, COALESCE(zone_id, surface_id, area_id, project_id));

-- ===== 8. Installer package + immutable revisions =====
CREATE TABLE public.installer_package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  title text NOT NULL,
  current_revision_no integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.installer_package TO authenticated;
GRANT ALL ON public.installer_package TO service_role;
ALTER TABLE public.installer_package ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installer_package read" ON public.installer_package FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "installer_package insert" ON public.installer_package FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "installer_package update" ON public.installer_package FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE TRIGGER trg_installer_package_updated BEFORE UPDATE ON public.installer_package
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE UNIQUE INDEX idx_installer_package_area ON public.installer_package(project_id, COALESCE(area_id, project_id));

CREATE TABLE public.installer_package_revision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.installer_package(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_no integer NOT NULL,
  snapshot jsonb NOT NULL,
  file_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL,
  published_by uuid,
  published_by_name text,
  published_at timestamptz NOT NULL DEFAULT now(),
  change_note text
);
GRANT SELECT, INSERT ON public.installer_package_revision TO authenticated;
GRANT ALL ON public.installer_package_revision TO service_role;
ALTER TABLE public.installer_package_revision ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipr read" ON public.installer_package_revision FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "ipr insert" ON public.installer_package_revision FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE UNIQUE INDEX idx_ipr_revision ON public.installer_package_revision(package_id, revision_no);

-- ===== 9. Deterministic readiness requirements =====
CREATE TABLE public.readiness_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE CASCADE,
  surface_id uuid REFERENCES public.project_surfaces(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.finish_zone(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  requirement_key text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  detail text,
  state text NOT NULL DEFAULT 'blocked',
  work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_requirement TO authenticated;
GRANT ALL ON public.readiness_requirement TO service_role;
ALTER TABLE public.readiness_requirement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readiness read" ON public.readiness_requirement FOR SELECT TO authenticated
  USING (public.can_access_project(auth.uid(), project_id));
CREATE POLICY "readiness insert" ON public.readiness_requirement FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "readiness update" ON public.readiness_requirement FOR UPDATE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id))
  WITH CHECK (public.can_edit_project(auth.uid(), project_id));
CREATE POLICY "readiness delete" ON public.readiness_requirement FOR DELETE TO authenticated
  USING (public.can_edit_project(auth.uid(), project_id));
CREATE UNIQUE INDEX idx_readiness_identity
  ON public.readiness_requirement(project_id, scope_key, requirement_key);
CREATE INDEX idx_readiness_project ON public.readiness_requirement(project_id);

-- ===== 10. Backfill legacy surface specifications (no guessing) =====
INSERT INTO public.finish_zone (project_id, surface_id, name, sort_order, is_default, created_at)
SELECT a.project_id, s.id, 'Main', 0, true, now()
FROM public.project_surfaces s
JOIN public.project_areas a ON a.id = s.area_id;

INSERT INTO public.finish_selection (
  project_id, label, tile_tag, manufacturer, tile_sku, tile_size, tile_finish, supplier, spec_status, notes
)
SELECT DISTINCT ON (a.project_id, COALESCE(s.tile_tag,''), COALESCE(s.manufacturer,''), COALESCE(s.tile_sku,''), COALESCE(s.tile_size,''), COALESCE(s.tile_finish,''), COALESCE(s.supplier,''))
  a.project_id,
  COALESCE(NULLIF(s.tile_tag,''), NULLIF(s.tile_sku,''), NULLIF(s.tile_size,''), 'Unspecified finish'),
  s.tile_tag, s.manufacturer, s.tile_sku, s.tile_size, s.tile_finish, s.supplier,
  'Migrated',
  'Migrated from surface specification'
FROM public.project_surfaces s
JOIN public.project_areas a ON a.id = s.area_id
WHERE COALESCE(s.tile_tag, s.tile_sku, s.tile_size, s.tile_finish, s.manufacturer, s.supplier) IS NOT NULL;

INSERT INTO public.finish_assignment (
  project_id, zone_id, finish_selection_id, grout_manufacturer, grout_color, joint_size,
  metal_profile, layout_pattern, layout_direction, start_point, tile_height, finish_transition,
  spec_status, confirmed_at
)
SELECT
  a.project_id,
  z.id,
  fs.id,
  s.grout_manufacturer, s.grout_color, s.joint_size, s.metal_profile,
  s.layout_pattern, s.layout_direction, s.start_point, s.tile_height, s.finish_transition,
  CASE WHEN s.detail_confirmed THEN 'Confirmed' ELSE 'Draft' END,
  CASE WHEN s.detail_confirmed THEN s.updated_at ELSE NULL END
FROM public.project_surfaces s
JOIN public.project_areas a ON a.id = s.area_id
JOIN public.finish_zone z ON z.surface_id = s.id AND z.is_default
LEFT JOIN public.finish_selection fs
  ON fs.project_id = a.project_id
 AND COALESCE(fs.tile_tag,'') = COALESCE(s.tile_tag,'')
 AND COALESCE(fs.manufacturer,'') = COALESCE(s.manufacturer,'')
 AND COALESCE(fs.tile_sku,'') = COALESCE(s.tile_sku,'')
 AND COALESCE(fs.tile_size,'') = COALESCE(s.tile_size,'')
 AND COALESCE(fs.tile_finish,'') = COALESCE(s.tile_finish,'')
 AND COALESCE(fs.supplier,'') = COALESCE(s.supplier,'');