-- Tile OS: files kept with a project — the tile paperwork, plans, photos.
-- One private bucket; only approved staff (anyone the admin has let in) can open or add files.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tileos-files', 'tileos-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Approved staff read Tile OS files" ON storage.objects;
CREATE POLICY "Approved staff read Tile OS files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'tileos-files' AND app_private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Approved staff add Tile OS files" ON storage.objects;
CREATE POLICY "Approved staff add Tile OS files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tileos-files' AND app_private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Approved staff change Tile OS files" ON storage.objects;
CREATE POLICY "Approved staff change Tile OS files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'tileos-files' AND app_private.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'tileos-files' AND app_private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Approved staff remove Tile OS files" ON storage.objects;
CREATE POLICY "Approved staff remove Tile OS files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'tileos-files' AND app_private.is_staff(auth.uid()));
