-- Tile OS: phone notifications.
-- Each device that turns them on is kept here: its push address and keys, whose it is (the person on Tile OS) and its
-- time zone. A person sees, adds and removes only their own devices; the app's server (the service role) reads them all
-- to send what's due.

CREATE TABLE IF NOT EXISTS public.tileos_push (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  person text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  tz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent timestamptz
);
ALTER TABLE public.tileos_push ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tileos_push TO authenticated;
GRANT ALL ON public.tileos_push TO service_role;
DROP POLICY IF EXISTS "Own devices are read" ON public.tileos_push;
DROP POLICY IF EXISTS "Own devices are added" ON public.tileos_push;
DROP POLICY IF EXISTS "Own devices are changed" ON public.tileos_push;
DROP POLICY IF EXISTS "Own devices are removed" ON public.tileos_push;
CREATE POLICY "Own devices are read" ON public.tileos_push FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own devices are added" ON public.tileos_push FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND app_private.is_staff(auth.uid()));
CREATE POLICY "Own devices are changed" ON public.tileos_push FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own devices are removed" ON public.tileos_push FOR DELETE TO authenticated USING (user_id = auth.uid());

-- what was sent (so nothing goes twice), and the server's own push keys: only the server touches these
CREATE TABLE IF NOT EXISTS public.tileos_push_sent (
  tag text PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tileos_push_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tileos_push_sent FROM anon, authenticated;
GRANT ALL ON public.tileos_push_sent TO service_role;

CREATE TABLE IF NOT EXISTS public.tileos_push_keys (
  id text PRIMARY KEY DEFAULT 'main',
  public_key text NOT NULL,
  private_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tileos_push_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tileos_push_keys FROM anon, authenticated;
GRANT ALL ON public.tileos_push_keys TO service_role;

-- every minute the database asks the app's server what's due; it sends it. If the timer can't be set up here, the
-- tables are still made, and reminders still show inside the app.
DO $outer$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tileos-remind';
  PERFORM cron.schedule(
    'tileos-remind',
    '* * * * *',
    $job$ SELECT net.http_post(url := 'https://cobblestone.lovable.app/api/remind', body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000) $job$
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Tile OS: the every-minute reminder check could not be set up (%)', SQLERRM;
END
$outer$;
