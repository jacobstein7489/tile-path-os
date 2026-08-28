ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage_steps_done text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS project_manager text;