CREATE TABLE public.field_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  crew_id uuid REFERENCES public.crews(id),
  crew_label text,
  worker_count integer,
  areas_worked text,
  progress_note text,
  blockers text,
  material_needed text,
  next_work text,
  notes text,
  submitted_by uuid,
  submitted_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX field_reports_project_date_idx ON public.field_reports (project_id, report_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.field_reports TO authenticated;
GRANT ALL ON public.field_reports TO service_role;

ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users read field reports" ON public.field_reports
  FOR SELECT TO authenticated USING (app_private.can_access_project(auth.uid(), project_id));

CREATE POLICY "Field users submit field reports" ON public.field_reports
  FOR INSERT TO authenticated WITH CHECK (app_private.can_field_project(auth.uid(), project_id));

CREATE POLICY "Field users update field reports" ON public.field_reports
  FOR UPDATE TO authenticated
  USING (app_private.can_field_project(auth.uid(), project_id))
  WITH CHECK (app_private.can_field_project(auth.uid(), project_id));

CREATE TRIGGER field_reports_touch BEFORE UPDATE ON public.field_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.project_files ADD COLUMN IF NOT EXISTS field_report_id uuid REFERENCES public.field_reports(id) ON DELETE SET NULL;

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS follow_up_on date,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS source_field_report_id uuid REFERENCES public.field_reports(id) ON DELETE SET NULL;