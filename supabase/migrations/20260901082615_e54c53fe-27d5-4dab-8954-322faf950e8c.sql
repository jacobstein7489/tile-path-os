ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.work_items ALTER COLUMN project_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS work_items_archived_idx ON public.work_items (archived_at);