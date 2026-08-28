CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  customer text,
  project_type text NOT NULL DEFAULT 'New Job',
  lifecycle_stage text NOT NULL DEFAULT 'New Submission',
  exception_state text,
  readiness_pct integer NOT NULL DEFAULT 0,
  readiness_note text,
  installation_progress integer NOT NULL DEFAULT 0,
  crew_lead text,
  start_date date,
  target_date date,
  material_status text NOT NULL DEFAULT 'Needed',
  needs_attention text,
  next_move text,
  next_move_owner text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Not Ready',
  progress_pct integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_surfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.project_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Not Ready',
  progress_pct integer NOT NULL DEFAULT 0,
  plan_sf numeric,
  field_sf numeric,
  tile_tag text,
  tile_size text,
  manufacturer text,
  supplier text,
  grout_color text,
  joint_size text,
  metal_profile text,
  layout_pattern text,
  prep text,
  waterproofing text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  surface_id uuid REFERENCES public.project_surfaces(id) ON DELETE SET NULL,
  item_type text NOT NULL,
  title text NOT NULL,
  description text,
  owner text,
  waiting_on text,
  status text NOT NULL DEFAULT 'Open',
  due_date date,
  impact text,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_areas_project ON public.project_areas(project_id);
CREATE INDEX idx_project_surfaces_area ON public.project_surfaces(area_id);
CREATE INDEX idx_work_items_project ON public.work_items(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_areas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_surfaces TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_items TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.project_areas TO service_role;
GRANT ALL ON public.project_surfaces TO service_role;
GRANT ALL ON public.work_items TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access to projects" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to areas" ON public.project_areas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to surfaces" ON public.project_surfaces FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to work items" ON public.work_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_areas_updated BEFORE UPDATE ON public.project_areas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_surfaces_updated BEFORE UPDATE ON public.project_surfaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_work_items_updated BEFORE UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.projects (id, name, address, customer, project_type, lifecycle_stage, readiness_pct, readiness_note, installation_progress, crew_lead, start_date, target_date, material_status, needs_attention, next_move, next_move_owner) VALUES
('11111111-1111-4111-8111-111111111111', '114 Park Place', '114 Park Place, Brooklyn, NY 11217', 'Park Place Development', 'New Job', 'New Submission', 15, 'Takeoff not started; areas and surfaces still being entered by estimator', 0, NULL, NULL, '2026-10-15', 'Needed', 'Scope questions unanswered for master bathroom', 'Complete takeoff and start estimate', 'Office Team'),
('22222222-2222-4222-8222-222222222222', '8-28 Clyde', '8-28 Clyde Street, Brooklyn, NY 11201', '8-28 Clyde Development', 'New Job', 'Installation', 100, 'All areas released to field; punch items pending', 55, 'Philip', '2026-08-10', '2026-09-12', 'Partially Received', 'Crew needs more thinset for 3rd floor sink area', 'Order thinset and deliver to site', 'Office Team');

INSERT INTO public.project_areas (id, project_id, name, sort_order, status, progress_pct, notes) VALUES
('aaaa1111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Master Bathroom', 1, 'Not Ready', 0, 'Plan measurements entered during takeoff'),
('aaaa1111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Main Floor', 2, 'Not Ready', 0, 'Awaiting tile selection'),
('bbbb2222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222', 'Basement Bathroom Floor', 1, 'Working', 90, NULL),
('bbbb2222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Staircase A', 2, 'Working', 65, NULL),
('bbbb2222-2222-4222-8222-222222222223', '22222222-2222-4222-8222-222222222222', '3rd Floor Sink Area', 3, 'Blocked', 40, 'Waiting on thinset'),
('bbbb2222-2222-4222-8222-222222222224', '22222222-2222-4222-8222-222222222222', '2nd Floor Bathroom Sink Area', 4, 'Working', 35, NULL);

INSERT INTO public.project_surfaces (area_id, name, sort_order, status, progress_pct, plan_sf, tile_tag, tile_size, manufacturer, supplier, grout_color, joint_size, layout_pattern) VALUES
('aaaa1111-1111-4111-8111-111111111111', 'Shower Floor', 1, 'Not Ready', 0, 18, 'T-1', '2x2 mosaic', 'TBD', 'TBD', NULL, '1/16"', 'Straight'),
('aaaa1111-1111-4111-8111-111111111111', 'Shower Wall A', 2, 'Not Ready', 0, 42, 'T-2', '12x24', 'TBD', 'TBD', NULL, '1/16"', 'Stacked'),
('aaaa1111-1111-4111-8111-111111111111', 'Niche', 3, 'Not Ready', 0, 4, 'T-1', '2x2 mosaic', 'TBD', 'TBD', NULL, '1/16"', 'Straight'),
('aaaa1111-1111-4111-8111-111111111112', 'Main Floor Field', 1, 'Not Ready', 0, 320, 'T-3', '24x24', 'TBD', 'TBD', NULL, '1/8"', 'Straight'),
('bbbb2222-2222-4222-8222-222222222221', 'Bathroom Floor Field', 1, 'Working', 90, 46, 'C-1', '12x24', 'Nemo', 'Nemo Tile', 'Warm Gray', '1/16"', 'Straight'),
('bbbb2222-2222-4222-8222-222222222222', 'Stair Treads', 1, 'Working', 65, 88, 'C-2', '12x24', 'Nemo', 'Nemo Tile', 'Warm Gray', '1/16"', 'Straight'),
('bbbb2222-2222-4222-8222-222222222223', 'Sink Area Floor', 1, 'Blocked', 40, 22, 'C-3', '12x12', 'Nemo', 'Nemo Tile', 'Warm Gray', '1/16"', 'Straight'),
('bbbb2222-2222-4222-8222-222222222224', 'Sink Area Floor', 1, 'Working', 35, 20, 'C-3', '12x12', 'Nemo', 'Nemo Tile', 'Warm Gray', '1/16"', 'Straight');

INSERT INTO public.work_items (project_id, area_id, item_type, title, description, owner, waiting_on, status, impact, next_action) VALUES
('22222222-2222-4222-8222-222222222222', 'bbbb2222-2222-4222-8222-222222222223', 'Material Need', 'More thinset needed', 'Crew needs additional thinset to continue 3rd Floor Sink Area.', 'Office Team', 'Tile Store', 'Open', 'Blocks 3rd Floor Sink Area installation', 'Order thinset and deliver to site'),
('22222222-2222-4222-8222-222222222222', 'bbbb2222-2222-4222-8222-222222222224', 'Question', 'Drain adjustment in 2nd floor bathroom', 'Confirm drain elevation before mud bed continues.', 'Philip', 'Contractor', 'Waiting', 'Holds mud bed work', 'Follow up with contractor'),
('11111111-1111-4111-8111-111111111111', 'aaaa1111-1111-4111-8111-111111111111', 'Question', 'Confirm shower wall tile selection', 'Owner has not confirmed tile for shower walls.', 'Office Team', 'Owner', 'Needs Answer', 'Blocks estimate completion', 'Send selection request to owner');