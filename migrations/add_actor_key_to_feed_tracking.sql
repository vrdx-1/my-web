BEGIN;

ALTER TABLE public.feed_actor_cycle_state
  ADD COLUMN IF NOT EXISTS actor_key TEXT;

UPDATE public.feed_actor_cycle_state
SET actor_key = CASE
  WHEN user_id IS NOT NULL THEN 'user:' || user_id
  WHEN guest_token IS NOT NULL THEN 'guest:' || guest_token
  ELSE NULL
END
WHERE actor_key IS NULL;

ALTER TABLE public.feed_actor_cycle_state
  ALTER COLUMN actor_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_actor_cycle_state_actor_scope_unique
  ON public.feed_actor_cycle_state(actor_key, feed_scope);

CREATE INDEX IF NOT EXISTS idx_feed_actor_cycle_state_actor_cycle
  ON public.feed_actor_cycle_state(actor_key, cycle_no);

COMMENT ON COLUMN public.feed_actor_cycle_state.actor_key IS 'Actor key รูปแบบ user:<id> หรือ guest:<token>';

ALTER TABLE public.feed_impressions
  ADD COLUMN IF NOT EXISTS actor_key TEXT;

UPDATE public.feed_impressions
SET actor_key = CASE
  WHEN user_id IS NOT NULL THEN 'user:' || user_id
  WHEN guest_token IS NOT NULL THEN 'guest:' || guest_token
  ELSE NULL
END
WHERE actor_key IS NULL;

ALTER TABLE public.feed_impressions
  ALTER COLUMN actor_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_impressions_actor_scope_cycle_post_unique
  ON public.feed_impressions(actor_key, feed_scope, cycle_no, post_id);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_actor_lookup
  ON public.feed_impressions(actor_key, feed_scope, cycle_no, seen_at DESC);

COMMENT ON COLUMN public.feed_impressions.actor_key IS 'Actor key รูปแบบ user:<id> หรือ guest:<token>';

COMMIT;
