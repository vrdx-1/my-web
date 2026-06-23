-- Lifetime post counters for all posts (admin, admin sub account, and regular users).
-- This counts only new post inserts in public.cars and never decrements when a post is deleted.

CREATE TABLE IF NOT EXISTS public.post_count_events (
  post_id text PRIMARY KEY,
  author_id text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('admin', 'admin_sub_account', 'user')),
  parent_admin_id text NULL,
  counted_at timestamptz NOT NULL DEFAULT now(),
  post_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_count_events_author
  ON public.post_count_events (author_id);

CREATE INDEX IF NOT EXISTS idx_post_count_events_account_type
  ON public.post_count_events (account_type);

CREATE INDEX IF NOT EXISTS idx_post_count_events_parent_admin
  ON public.post_count_events (parent_admin_id)
  WHERE parent_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_count_events_counted_at
  ON public.post_count_events (counted_at DESC);

CREATE TABLE IF NOT EXISTS public.account_post_stats (
  account_id text PRIMARY KEY,
  account_type text NOT NULL CHECK (account_type IN ('admin', 'admin_sub_account', 'user')),
  total_posts_all_time bigint NOT NULL DEFAULT 0,
  last_counted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_post_stats_type_count
  ON public.account_post_stats (account_type, total_posts_all_time DESC);

CREATE TABLE IF NOT EXISTS public.admin_sub_account_post_stats (
  admin_id text PRIMARY KEY,
  total_sub_posts_all_time bigint NOT NULL DEFAULT 0,
  last_counted_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sub_account_post_stats_count
  ON public.admin_sub_account_post_stats (total_sub_posts_all_time DESC);

CREATE TABLE IF NOT EXISTS public.global_post_stats (
  singleton_id boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  total_posts_all_time bigint NOT NULL DEFAULT 0,
  total_admin_posts_all_time bigint NOT NULL DEFAULT 0,
  total_admin_sub_posts_all_time bigint NOT NULL DEFAULT 0,
  total_user_posts_all_time bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.global_post_stats (singleton_id)
VALUES (TRUE)
ON CONFLICT (singleton_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_post_counters(
  p_post_id text,
  p_author_id text,
  p_post_created_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_inserted_post_id text;
  v_role text;
  v_is_sub_account boolean;
  v_parent_admin_id text;
  v_parent_role text;
  v_account_type text;
BEGIN
  IF p_post_id IS NULL OR p_post_id = '' OR p_author_id IS NULL OR p_author_id = '' THEN
    RETURN FALSE;
  END IF;

  SELECT
    p.role,
    COALESCE(p.is_sub_account, FALSE),
    p.parent_admin_id
  INTO
    v_role,
    v_is_sub_account,
    v_parent_admin_id
  FROM public.profiles p
  WHERE p.id = p_author_id
  LIMIT 1;

  IF v_is_sub_account = TRUE AND v_parent_admin_id IS NOT NULL THEN
    SELECT p.role
    INTO v_parent_role
    FROM public.profiles p
    WHERE p.id = v_parent_admin_id
    LIMIT 1;

    IF v_parent_role = 'admin' THEN
      v_account_type := 'admin_sub_account';
    ELSE
      v_account_type := 'user';
      v_parent_admin_id := NULL;
    END IF;
  ELSIF v_role = 'admin' THEN
    v_account_type := 'admin';
    v_parent_admin_id := NULL;
  ELSE
    v_account_type := 'user';
    v_parent_admin_id := NULL;
  END IF;

  INSERT INTO public.post_count_events (
    post_id,
    author_id,
    account_type,
    parent_admin_id,
    post_created_at,
    counted_at
  )
  VALUES (
    p_post_id,
    p_author_id,
    v_account_type,
    v_parent_admin_id,
    COALESCE(p_post_created_at, now()),
    now()
  )
  ON CONFLICT (post_id) DO NOTHING
  RETURNING post_id INTO v_inserted_post_id;

  IF v_inserted_post_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.account_post_stats (
    account_id,
    account_type,
    total_posts_all_time,
    last_counted_at,
    updated_at
  )
  VALUES (
    p_author_id,
    v_account_type,
    1,
    now(),
    now()
  )
  ON CONFLICT (account_id) DO UPDATE
  SET
    account_type = EXCLUDED.account_type,
    total_posts_all_time = public.account_post_stats.total_posts_all_time + 1,
    last_counted_at = EXCLUDED.last_counted_at,
    updated_at = now();

  IF v_account_type = 'admin_sub_account' AND v_parent_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_sub_account_post_stats (
      admin_id,
      total_sub_posts_all_time,
      last_counted_at,
      updated_at
    )
    VALUES (
      v_parent_admin_id,
      1,
      now(),
      now()
    )
    ON CONFLICT (admin_id) DO UPDATE
    SET
      total_sub_posts_all_time = public.admin_sub_account_post_stats.total_sub_posts_all_time + 1,
      last_counted_at = EXCLUDED.last_counted_at,
      updated_at = now();
  END IF;

  INSERT INTO public.global_post_stats (
    singleton_id,
    total_posts_all_time,
    total_admin_posts_all_time,
    total_admin_sub_posts_all_time,
    total_user_posts_all_time,
    updated_at
  )
  VALUES (
    TRUE,
    1,
    CASE WHEN v_account_type = 'admin' THEN 1 ELSE 0 END,
    CASE WHEN v_account_type = 'admin_sub_account' THEN 1 ELSE 0 END,
    CASE WHEN v_account_type = 'user' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (singleton_id) DO UPDATE
  SET
    total_posts_all_time = public.global_post_stats.total_posts_all_time + 1,
    total_admin_posts_all_time = public.global_post_stats.total_admin_posts_all_time + CASE WHEN v_account_type = 'admin' THEN 1 ELSE 0 END,
    total_admin_sub_posts_all_time = public.global_post_stats.total_admin_sub_posts_all_time + CASE WHEN v_account_type = 'admin_sub_account' THEN 1 ELSE 0 END,
    total_user_posts_all_time = public.global_post_stats.total_user_posts_all_time + CASE WHEN v_account_type = 'user' THEN 1 ELSE 0 END,
    updated_at = now();

  RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.increment_post_counters(text, text, timestamptz)
IS 'Counts only newly inserted posts once and updates lifetime global/account counters. Reposts are excluded because they are updates, not inserts.';

REVOKE ALL ON FUNCTION public.increment_post_counters(text, text, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_count_new_car_posts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.increment_post_counters(
    NEW.id::text,
    NEW.user_id::text,
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_count_new_car_posts() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_count_new_car_posts ON public.cars;

CREATE TRIGGER trg_count_new_car_posts
AFTER INSERT ON public.cars
FOR EACH ROW
EXECUTE FUNCTION public.trg_count_new_car_posts();

DO $backfill$
DECLARE
  v_backfilled_rows bigint;
BEGIN
  WITH post_rows AS (
    SELECT
      c.id::text AS post_id,
      c.user_id::text AS author_id,
      COALESCE(c.created_at, now()) AS post_created_at
    FROM public.cars c
    WHERE c.id IS NOT NULL
      AND c.user_id IS NOT NULL
  ), backfill_run AS (
    SELECT public.increment_post_counters(post_id, author_id, post_created_at) AS inserted
    FROM post_rows
  )
  SELECT COUNT(*) FILTER (WHERE inserted = TRUE)
  INTO v_backfilled_rows
  FROM backfill_run;

  RAISE NOTICE 'Lifetime post counters backfill inserted % new counter rows.', v_backfilled_rows;
END;
$backfill$;
