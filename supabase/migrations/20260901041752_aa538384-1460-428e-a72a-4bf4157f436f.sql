ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS workflow_step text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.work_item_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  message text NOT NULL,
  actor text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.work_item_events TO anon, authenticated;
GRANT ALL ON public.work_item_events TO service_role;

ALTER TABLE public.work_item_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read work item history"
  ON public.work_item_events FOR SELECT USING (true);

CREATE POLICY "Anyone can add work item history"
  ON public.work_item_events FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS work_item_events_item_idx ON public.work_item_events (work_item_id, created_at DESC);