CREATE TABLE public.application_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  administrator_bootstrapped_at timestamptz,
  CONSTRAINT application_bootstrap_singleton CHECK (singleton = true)
);
GRANT SELECT ON public.application_bootstrap TO authenticated;
GRANT ALL ON public.application_bootstrap TO service_role;
ALTER TABLE public.application_bootstrap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators can read bootstrap state"
ON public.application_bootstrap FOR SELECT TO authenticated
USING (app_private.is_company_operator(auth.uid()));

INSERT INTO public.application_bootstrap (singleton, administrator_bootstrapped_at)
VALUES (true, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN now() ELSE NULL END);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_initials text;
  v_claim_bootstrap boolean := false;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));
  v_initials := upper(left(coalesce(split_part(v_name,' ',1),'?'),1) || coalesce(left(nullif(split_part(v_name,' ',2),''),1),''));
  INSERT INTO public.profiles (user_id, full_name, initials, email)
  VALUES (NEW.id, v_name, NULLIF(v_initials,''), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM pg_advisory_xact_lock(hashtext('cobblestone:first-administrator'));
  UPDATE public.application_bootstrap
  SET administrator_bootstrapped_at = now()
  WHERE singleton = true AND administrator_bootstrapped_at IS NULL
  RETURNING true INTO v_claim_bootstrap;

  IF COALESCE(v_claim_bootstrap, false) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;