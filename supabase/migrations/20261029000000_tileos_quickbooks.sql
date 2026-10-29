-- Tile OS: the company's QuickBooks Online connection (one row, id 'main').
-- It holds the QuickBooks sign-in tokens, so no browser can read or change it: row level security is on and there is
-- no policy at all — only the app's server (the service role) can touch it.

CREATE TABLE IF NOT EXISTS public.tileos_quickbooks (
  id text PRIMARY KEY DEFAULT 'main',
  realm_id text,
  company text,
  access_token text,
  refresh_token text,
  access_expires timestamptz,
  refresh_expires timestamptz,
  env text,
  state text,
  state_expires timestamptz,
  origin text,
  connected_at timestamptz,
  connected_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tileos_quickbooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tileos_quickbooks FROM anon, authenticated;
