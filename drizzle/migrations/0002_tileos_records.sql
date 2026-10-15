-- Tile OS: everything the app keeps, one row per record — a project, a task, an estimate, a client…
-- (collection = what kind of record, id = which one, data = the record itself).
-- Approved staff (anyone the admin has let in) read and write; changes are broadcast live to everyone signed in.

CREATE TABLE IF NOT EXISTS public.tileos_records (
  collection text NOT NULL,
  id text NOT NULL,
  data jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid(),
  client_id text,
  PRIMARY KEY (collection, id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tileos_records TO authenticated;
GRANT ALL ON public.tileos_records TO service_role;
ALTER TABLE public.tileos_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved staff read Tile OS records" ON public.tileos_records
  FOR SELECT TO authenticated USING (app_private.is_staff(auth.uid()));
CREATE POLICY "Approved staff add Tile OS records" ON public.tileos_records
  FOR INSERT TO authenticated WITH CHECK (app_private.is_staff(auth.uid()));
CREATE POLICY "Approved staff change Tile OS records" ON public.tileos_records
  FOR UPDATE TO authenticated USING (app_private.is_staff(auth.uid())) WITH CHECK (app_private.is_staff(auth.uid()));
CREATE POLICY "Approved staff remove Tile OS records" ON public.tileos_records
  FOR DELETE TO authenticated USING (app_private.is_staff(auth.uid()));

-- who changed it last, and when
CREATE OR REPLACE FUNCTION public.tileos_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tileos_touch() FROM anon, public;
DROP TRIGGER IF EXISTS trg_tileos_touch ON public.tileos_records;
CREATE TRIGGER trg_tileos_touch BEFORE INSERT OR UPDATE ON public.tileos_records
  FOR EACH ROW EXECUTE FUNCTION public.tileos_touch();

-- live updates (deleted rows carry their whole old row, so everyone knows which record went)
ALTER TABLE public.tileos_records REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tileos_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tileos_records;
  END IF;
END $$;