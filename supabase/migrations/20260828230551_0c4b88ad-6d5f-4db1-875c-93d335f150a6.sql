-- ============ CREWS ============
CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text NOT NULL,
  tone text NOT NULL DEFAULT 'blue',
  sort_order integer NOT NULL DEFAULT 0,
  is_open_lane boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crews TO anon, authenticated;
GRANT ALL ON public.crews TO service_role;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to crews" ON public.crews FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_crews_updated BEFORE UPDATE ON public.crews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SCHEDULE ASSIGNMENTS ============
CREATE TABLE public.schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  work_date date NOT NULL,
  span_days integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'Tile / Grout',
  status text NOT NULL DEFAULT 'Scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_assignments TO anon, authenticated;
GRANT ALL ON public.schedule_assignments TO service_role;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to schedule" ON public.schedule_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sched_updated BEFORE UPDATE ON public.schedule_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ MATERIAL ITEMS ============
CREATE TABLE public.material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.project_areas(id) ON DELETE SET NULL,
  surface_id uuid REFERENCES public.project_surfaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  spec text,
  category text NOT NULL DEFAULT 'Installation Materials',
  goes_to text,
  supplier text,
  responsibility text,
  unit text,
  required_qty numeric,
  ordered_qty numeric NOT NULL DEFAULT 0,
  received_qty numeric NOT NULL DEFAULT 0,
  damaged_qty numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Needed',
  next_step text,
  expected_date date,
  needs_attention boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_items TO anon, authenticated;
GRANT ALL ON public.material_items TO service_role;
ALTER TABLE public.material_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to material items" ON public.material_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.material_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL,
  supplier text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Draft',
  expected_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO anon, authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to purchase orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.po_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_item_id uuid REFERENCES public.material_items(id) ON DELETE SET NULL,
  description text,
  qty numeric NOT NULL DEFAULT 1,
  unit text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_lines TO anon, authenticated;
GRANT ALL ON public.po_lines TO service_role;
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to po lines" ON public.po_lines FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_po_lines_updated BEFORE UPDATE ON public.po_lines FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ APPEND-ONLY RECEIPTS ============
CREATE TABLE public.material_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_item_id uuid NOT NULL REFERENCES public.material_items(id) ON DELETE CASCADE,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  received_qty numeric NOT NULL DEFAULT 0,
  damaged_qty numeric NOT NULL DEFAULT 0,
  wrong_qty numeric NOT NULL DEFAULT 0,
  packing_slip text,
  received_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.material_receipts TO anon, authenticated;
GRANT ALL ON public.material_receipts TO service_role;
ALTER TABLE public.material_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read receipts" ON public.material_receipts FOR SELECT USING (true);
CREATE POLICY "Anyone can add receipts" ON public.material_receipts FOR INSERT WITH CHECK (true);

-- ============ VISIT CHECKLIST ============
CREATE TABLE public.visit_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_checklist_items TO anon, authenticated;
GRANT ALL ON public.visit_checklist_items TO service_role;
ALTER TABLE public.visit_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to visit checklist" ON public.visit_checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_visit_updated BEFORE UPDATE ON public.visit_checklist_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXTRA COLUMNS ============
ALTER TABLE public.project_surfaces
  ADD COLUMN IF NOT EXISTS tile_sku text,
  ADD COLUMN IF NOT EXISTS tile_finish text,
  ADD COLUMN IF NOT EXISTS grout_manufacturer text,
  ADD COLUMN IF NOT EXISTS layout_direction text,
  ADD COLUMN IF NOT EXISTS start_point text,
  ADD COLUMN IF NOT EXISTS tile_height text,
  ADD COLUMN IF NOT EXISTS finish_transition text,
  ADD COLUMN IF NOT EXISTS underlayment text,
  ADD COLUMN IF NOT EXISTS detail_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ============ DEMO DATA ============
UPDATE public.projects SET lifecycle_stage='Office Setup', installation_progress=0, readiness_pct=40,
  readiness_note='Areas and surfaces built during estimating. Waiting on shower wall tile and grout selections.',
  next_move='Confirm shower wall tile and grout selections', next_move_owner='Office',
  material_status='Needed', stage_steps_done=ARRAY['Project Info','Areas & Surfaces']
WHERE id='11111111-1111-4111-8111-111111111111';

UPDATE public.projects SET lifecycle_stage='Installation', installation_progress=55, readiness_pct=100,
  readiness_note='All areas released for installation.', crew_lead='Philip',
  material_status='Short', needs_attention='Thinset shortage reported by Philip',
  next_move='Order thinset and confirm delivery', next_move_owner='Office / Materials'
WHERE id='22222222-2222-4222-8222-222222222222';

INSERT INTO public.projects (id,name,address,customer,project_type,lifecycle_stage,readiness_pct,readiness_note,installation_progress,crew_lead,project_manager,start_date,target_date,material_status,needs_attention,next_move,next_move_owner,stage_steps_done) VALUES
('33333333-3333-4333-8333-333333333333','24 Cambridge','24 Cambridge St','Cambridge Holdings','New Job','Installation',100,'Released for installation.',40,'Walter','Office','2026-08-24','2026-09-11','Ready',NULL,'Review current work area and remove or restage extra material','Site Manager',ARRAY[]::text[]),
('44444444-4444-4444-8444-444444444444','118 Park','118 Park Ave','Park Ave Residences','New Job','Installation',100,'Released for installation.',30,'Leo','Office','2026-08-25','2026-09-18','Partially Received','Metal trim specs and ETA not confirmed','Confirm progress and bathroom layout detail','Site Manager',ARRAY[]::text[]),
('55555555-5555-4555-8555-555555555555','2385 Forest Circle','2385 Forest Cir','Forest Circle LLC','New Job','Installation',100,'Released for installation.',65,'Alex','Office','2026-08-26','2026-09-04','Ready',NULL,'Answer wire / sheetrock direction question','Site Manager',ARRAY[]::text[]),
('66666666-6666-4666-8666-666666666666','2:45 Pavel','245 Pavel Rd','Pavel Family','Repair','Punch / Return',100,'Repair scope confirmed.',90,NULL,'Office',NULL,'2026-09-02','Ready',NULL,'Review repair scope and assign return visit','Office',ARRAY['Punch Open']),
('77777777-7777-4777-8777-777777777777','8-30 Northwood','830 Northwood Dr','Northwood Group','Warranty','Punch / Return',100,'Touch-up list captured.',95,NULL,'Office',NULL,'2026-09-05','Ready',NULL,'Confirm touch-ups and schedule return','Office',ARRAY['Punch Open']),
('88888888-8888-4888-8888-888888888888','Green Tree / County Line','Green Tree at County Line','Green Tree Development','New Job','Ready to Schedule',100,'Materials ready, crew not assigned.',0,NULL,'Office',NULL,'2026-09-08','Ready','No crew assigned and chalk-line supplies unconfirmed','Assign crew and resume','Office',ARRAY[]::text[]),
('99999999-9999-4999-8999-999999999999','5:30 Mark','530 Mark St','Mark Properties','New Job','Materials & Readiness',60,'Floor prep materials not ordered.',0,NULL,'Office',NULL,'2026-09-15','To Order','Portland cement and sand not ordered','Order Portland and sand','Office / Materials',ARRAY['Requirements Confirmed']);

INSERT INTO public.crews (id,name,initials,tone,sort_order,is_open_lane) VALUES
('c1111111-1111-4111-8111-111111111111','Walter','WS','blue',1,false),
('c2222222-2222-4222-8222-222222222222','Leo','LM','green',2,false),
('c3333333-3333-4333-8333-333333333333','Alex','AS','violet',3,false),
('c4444444-4444-4444-8444-444444444444','Philip','PB','amber',4,false),
('c5555555-5555-4555-8555-555555555555','Open Crew','OC','neutral',5,true);

INSERT INTO public.schedule_assignments (project_id,crew_id,work_date,span_days,kind,status) VALUES
('33333333-3333-4333-8333-333333333333','c1111111-1111-4111-8111-111111111111','2026-08-24',2,'Tile / Grout','Scheduled'),
('33333333-3333-4333-8333-333333333333','c1111111-1111-4111-8111-111111111111','2026-08-27',1,'Return Visit','Scheduled'),
('44444444-4444-4444-8444-444444444444','c2222222-2222-4222-8222-222222222222','2026-08-25',1,'Tile / Grout','Scheduled'),
('44444444-4444-4444-8444-444444444444','c2222222-2222-4222-8222-222222222222','2026-08-27',1,'Return Visit','Scheduled'),
('55555555-5555-4555-8555-555555555555','c3333333-3333-4333-8333-333333333333','2026-08-26',1,'Tile / Grout','Scheduled'),
('55555555-5555-4555-8555-555555555555','c3333333-3333-4333-8333-333333333333','2026-08-28',1,'Return Visit','Scheduled'),
('22222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444','2026-08-24',1,'Tile / Grout','Scheduled'),
('22222222-2222-4222-8222-222222222222','c4444444-4444-4444-8444-444444444444','2026-08-26',1,'Return Visit','Scheduled');

INSERT INTO public.material_items (id,project_id,name,spec,category,goes_to,supplier,responsibility,unit,required_qty,ordered_qty,received_qty,status,next_step,needs_attention,expected_date) VALUES
('a1111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Thinset','Versabond-LFT — 50 lb','Installation Materials','Restrooms','Cobblestone (supplied)','Cobblestone','bags',24,24,0,'Short','Schedule delivery or confirm on hand',true,'2026-08-31'),
('a2222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999','Portland Cement','Type I — 94 lb','Installation Materials','Floor Prep','Cobblestone (supplied)','Cobblestone','bags',12,0,0,'To Order','Order and confirm delivery',true,NULL),
('a3333333-3333-4333-8333-333333333333','99999999-9999-4999-8999-999999999999','Sand','Concrete Sand — 50 lb','Installation Materials','Floor Prep','Cobblestone (supplied)','Cobblestone','bags',30,0,0,'To Order','Order and confirm delivery',true,NULL),
('a4444444-4444-4444-8444-444444444444','88888888-8888-4888-8888-888888888888','Chalk-Line Supplies','Line, reels, blue chalk','Installation Materials','All Areas','Cobblestone (supplied)','Cobblestone','sets',3,3,0,'Expected','Confirm availability and delivery',true,'2026-09-01'),
('a5555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','Metal Trim Pieces','Satin Nickel — 1/4"','Grout & Metals','Lobby Walls','Metal Works Inc.','Vendor','pcs',40,40,0,'Ordered','Confirm specs and ETA',true,'2026-09-03'),
('a6666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','Basement toilet wall tile T11','3x12 Ceramic — Pearl','Finish Tile','Basement Toilet Walls','Tile Store','Tile Store Supplied','boxes',30,30,18,'Partially Received','Follow up supplier',true,'2026-09-02'),
('a7777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','Basement toilet floor tile T10','12x24 Porcelain — Bianco','Finish Tile','Basement Toilet Floors','Tile Store','Tile Store Supplied','boxes',22,22,15,'Partially Received','Follow up supplier',true,'2026-09-02'),
('a8888888-8888-4888-8888-888888888888','55555555-5555-4555-8555-555555555555','Ballroom field tile','24x24 Porcelain — Grigio','Finish Tile','Ballroom','Tile Store','Tile Store Supplied','pallets',8,8,6,'Partially Received','Follow up supplier',true,'2026-09-04'),
('a9999999-9999-4999-8999-999999999999','44444444-4444-4444-8444-444444444444','Epoxy grout','Mapei Kerapoxy — Silver','Grout & Metals','1st Floor Kitchen','Tile Store','GC Supplied','buckets',14,14,7,'Partially Received','Follow up supplier',true,'2026-09-06'),
('aaaaaaaa-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','Expansion metal','Schluter Dilex — 3/8"','Grout & Metals','3rd Floor Bathroom / Sink Area','Metal Works Inc.','Vendor','pcs',18,18,18,'Received','Confirm install detail',false,'2026-08-24'),
('aaaaaaaa-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Shower wall tile (TBD)','Selection pending','Finish Tile','Master Bathroom — Shower Walls','Tile Store','Tile Store Supplied','boxes',NULL,0,0,'Needed','Confirm selection with customer',true,NULL);

INSERT INTO public.purchase_orders (id,po_number,supplier,project_id,status,expected_date,notes) VALUES
('b1111111-1111-4111-8111-111111111111','PO-1042','Tile Store','33333333-3333-4333-8333-333333333333','Partially Received','2026-09-02','Basement toilet tile package.');

INSERT INTO public.po_lines (po_id,material_item_id,description,qty,unit) VALUES
('b1111111-1111-4111-8111-111111111111','a6666666-6666-4666-8666-666666666666','Basement toilet wall tile T11',30,'boxes'),
('b1111111-1111-4111-8111-111111111111','a7777777-7777-4777-8777-777777777777','Basement toilet floor tile T10',22,'boxes');

INSERT INTO public.material_receipts (material_item_id,po_id,receipt_date,received_qty,damaged_qty,notes) VALUES
('a6666666-6666-4666-8666-666666666666','b1111111-1111-4111-8111-111111111111','2026-08-26',18,0,'First partial delivery.'),
('a7777777-7777-4777-8777-777777777777','b1111111-1111-4111-8111-111111111111','2026-08-26',15,2,'Two boxes damaged in transit.');

INSERT INTO public.visit_checklist_items (project_id,label,done,sort_order) VALUES
('22222222-2222-4222-8222-222222222222','Visit the job and confirm active work areas',true,1),
('22222222-2222-4222-8222-222222222222','Update progress by area',true,2),
('22222222-2222-4222-8222-222222222222','Upload photos / videos',true,3),
('22222222-2222-4222-8222-222222222222','Confirm thinset request from Philip',false,4),
('22222222-2222-4222-8222-222222222222','Log any new issues or changes',false,5);

INSERT INTO public.work_items (project_id,item_type,title,owner,waiting_on,status,priority,next_action,impact) VALUES
('33333333-3333-4333-8333-333333333333','Task','Review current work area and remove or restage extra material','Site Manager',NULL,'Open','High','Review & restage','Slows active work area'),
('44444444-4444-4444-8444-444444444444','Task','Confirm progress and bathroom layout detail','Site Manager',NULL,'Open','High','Confirm layout','Layout must be confirmed before grouting'),
('55555555-5555-4555-8555-555555555555','Question','Answer wire / sheetrock direction question','Site Manager','Electrician','Waiting','Medium','Provide answer','Blocks sink area'),
('22222222-2222-4222-8222-222222222222','Material Need','Verify thinset shortage and submit material request','Office / Materials',NULL,'Open','High','Request material','Installation will stop without thinset'),
('66666666-6666-4666-8666-666666666666','Punch / Return Item','Review repair scope and assign return visit','Office',NULL,'Open','Medium','Assign return visit','Return visit not scheduled'),
('88888888-8888-4888-8888-888888888888','Task','Find someone for chalk lines','Office',NULL,'Open','Low','Find crew','Job cannot resume'),
('99999999-9999-4999-8999-999999999999','Material Need','Order Portland and sand','Office / Materials',NULL,'Open','Low','Place order','Floor prep cannot start'),
('77777777-7777-4777-8777-777777777777','Punch / Return Item','Touch-up list reviewed','Office',NULL,'Complete','Low','Completed',NULL),
('11111111-1111-4111-8111-111111111111','Task','New job acknowledged','Office',NULL,'Complete','Low','Completed',NULL);