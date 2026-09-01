ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS waiting_on_user_id uuid,
  ADD COLUMN IF NOT EXISTS waiting_on_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waiting_on_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_owner_user ON public.work_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_work_items_waiting_company ON public.work_items(waiting_on_company_id);

CREATE OR REPLACE FUNCTION public.validate_work_item_people()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF num_nonnulls(NEW.waiting_on_user_id, NEW.waiting_on_contact_id, NEW.waiting_on_company_id) > 1 THEN
    RAISE EXCEPTION 'A work item can wait on only one person or company';
  END IF;
  IF NEW.owner_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.owner_user_id AND p.is_active
  ) THEN
    RAISE EXCEPTION 'Work item owner must be an active configured employee';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_work_item_people ON public.work_items;
CREATE TRIGGER trg_validate_work_item_people
BEFORE INSERT OR UPDATE OF owner_user_id, waiting_on_user_id, waiting_on_contact_id, waiting_on_company_id
ON public.work_items
FOR EACH ROW EXECUTE FUNCTION public.validate_work_item_people();

WITH candidates AS (
  SELECT w.id, min(p.user_id::text)::uuid AS user_id
  FROM public.work_items w
  JOIN public.profiles p
    ON lower(trim(w.owner)) IN (lower(trim(p.full_name)), lower(trim(coalesce(p.job_title,''))))
  WHERE w.owner_user_id IS NULL AND w.owner IS NOT NULL
  GROUP BY w.id
  HAVING count(*) = 1
)
UPDATE public.work_items w SET owner_user_id = c.user_id
FROM candidates c WHERE w.id = c.id;

WITH candidates AS (
  SELECT w.id, min(c.id::text)::uuid AS company_id
  FROM public.work_items w
  JOIN public.companies c ON lower(trim(w.waiting_on)) = lower(trim(c.name))
  WHERE w.waiting_on IS NOT NULL
    AND w.waiting_on_user_id IS NULL AND w.waiting_on_contact_id IS NULL AND w.waiting_on_company_id IS NULL
  GROUP BY w.id HAVING count(*) = 1
)
UPDATE public.work_items w SET waiting_on_company_id = c.company_id
FROM candidates c WHERE w.id = c.id;

COMMENT ON COLUMN public.work_items.owner IS 'Legacy owner text retained as rollback data; use owner_user_id for current ownership.';
COMMENT ON COLUMN public.work_items.waiting_on IS 'Legacy waiting-on text retained as rollback data; use the relational waiting_on fields.';