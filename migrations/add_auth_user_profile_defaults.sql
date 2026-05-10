-- ============================================================
-- Ensure profile defaults are created from auth.users (backend-first)
-- - username: local-part of email (text before '@')
-- - avatar_url: null
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_profile_defaults_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  username_from_email text;
BEGIN
  username_from_email := nullif(split_part(coalesce(NEW.email, ''), '@', 1), '');

  INSERT INTO public.profiles (id, username, avatar_url, updated_at)
  VALUES (
    NEW.id::text,
    coalesce(username_from_email, 'Guest User'),
    null,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    username = CASE
      WHEN coalesce(trim(public.profiles.username), '') = '' OR public.profiles.username = 'Guest User'
        THEN EXCLUDED.username
      ELSE public.profiles.username
    END,
    avatar_url = null,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_defaults_from_auth_user ON auth.users;
CREATE TRIGGER trg_sync_profile_defaults_from_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_defaults_from_auth_user();
