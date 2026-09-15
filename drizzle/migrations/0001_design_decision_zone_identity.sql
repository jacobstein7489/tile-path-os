DROP INDEX IF EXISTS public.idx_design_decision_identity;
CREATE UNIQUE INDEX idx_design_decision_zone_identity
  ON public.design_decision(project_id, question_key, zone_id);