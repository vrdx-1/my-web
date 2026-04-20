-- Auto repost ready-to-sell posts for sub accounts whose parent profile is an admin.
--
-- Behavior:
-- - Only repost posts in the ready-to-sell feed (`status = 'recommend'`).
-- - Only repost posts owned by profiles where `is_sub_account = true`.
-- - Only repost when that sub account belongs to a parent profile with `role = 'admin'`.
-- - Only repost posts that are visible (`is_hidden` is false or null).
-- - Only repost when the post age is at least 6 days.
-- - Reposting is implemented by refreshing `cars.created_at`, matching the app's manual repost behavior.

CREATE INDEX IF NOT EXISTS idx_cars_auto_repost_candidates
  ON public.cars (user_id, created_at)
  WHERE status = 'recommend' AND COALESCE(is_hidden, FALSE) = FALSE;

CREATE OR REPLACE FUNCTION public.auto_repost_admin_sub_account_posts(run_at TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE(updated_count BIGINT, updated_post_ids TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  reposted_ids TEXT[];
BEGIN
  WITH eligible_posts AS (
    SELECT c.id
    FROM public.cars AS c
    INNER JOIN public.profiles AS child
      ON child.id = c.user_id::text
    INNER JOIN public.profiles AS parent
      ON parent.id = child.parent_admin_id
    WHERE child.is_sub_account = TRUE
      AND child.parent_admin_id IS NOT NULL
      AND parent.role = 'admin'
      AND c.status = 'recommend'
      AND COALESCE(c.is_hidden, FALSE) = FALSE
      AND c.created_at <= (run_at - INTERVAL '6 days')
  ), updated_posts AS (
    UPDATE public.cars AS c
    SET created_at = run_at
    FROM eligible_posts AS ep
    WHERE c.id = ep.id
    RETURNING c.id::text
  )
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::TEXT[])
  INTO reposted_ids
  FROM updated_posts;

  RETURN QUERY
  SELECT COALESCE(array_length(reposted_ids, 1), 0)::BIGINT, reposted_ids;
END;
$function$;

COMMENT ON FUNCTION public.auto_repost_admin_sub_account_posts(TIMESTAMPTZ)
IS 'Auto repost visible recommend posts after 6 days, limited to sub accounts whose parent profile has role=admin.';

REVOKE ALL ON FUNCTION public.auto_repost_admin_sub_account_posts(TIMESTAMPTZ) FROM PUBLIC;

DO $block$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) THEN
    EXECUTE $sql$
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'auto-repost-admin-sub-account-posts'
      LIMIT 1
    $sql$
    INTO existing_job_id;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;

    PERFORM cron.schedule(
      'auto-repost-admin-sub-account-posts',
      '*/15 * * * *',
      $cron$SELECT public.auto_repost_admin_sub_account_posts();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not enabled. Enable pg_cron, then schedule: SELECT cron.schedule(''auto-repost-admin-sub-account-posts'', ''*/15 * * * *'', $$SELECT public.auto_repost_admin_sub_account_posts();$$);';
  END IF;
END
$block$;