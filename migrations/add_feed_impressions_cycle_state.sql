BEGIN;

CREATE TABLE IF NOT EXISTS public.feed_actor_cycle_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_token TEXT NULL,
  feed_scope TEXT NOT NULL,
  cycle_no INTEGER NOT NULL DEFAULT 1,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feed_actor_cycle_state_actor_check
    CHECK (
      (user_id IS NOT NULL AND guest_token IS NULL)
      OR (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_actor_cycle_state_user_scope_unique
  ON public.feed_actor_cycle_state(user_id, feed_scope)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_actor_cycle_state_guest_scope_unique
  ON public.feed_actor_cycle_state(guest_token, feed_scope)
  WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_actor_cycle_state_scope_cycle
  ON public.feed_actor_cycle_state(feed_scope, cycle_no);

COMMENT ON TABLE public.feed_actor_cycle_state IS 'Current feed cycle per actor (user_id or guest_token) and feed scope.';
COMMENT ON COLUMN public.feed_actor_cycle_state.feed_scope IS 'Scope key เช่น recommend:all หรือ recommend:Vientiane';
COMMENT ON COLUMN public.feed_actor_cycle_state.cycle_no IS 'รอบการแสดงผลปัจจุบันของ actor ใน scope นี้';

CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  user_id TEXT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_token TEXT NULL,
  feed_scope TEXT NOT NULL,
  cycle_no INTEGER NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feed_impressions_actor_check
    CHECK (
      (user_id IS NOT NULL AND guest_token IS NULL)
      OR (user_id IS NULL AND guest_token IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_impressions_user_scope_cycle_post_unique
  ON public.feed_impressions(user_id, feed_scope, cycle_no, post_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_impressions_guest_scope_cycle_post_unique
  ON public.feed_impressions(guest_token, feed_scope, cycle_no, post_id)
  WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_impressions_user_lookup
  ON public.feed_impressions(user_id, feed_scope, cycle_no, seen_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feed_impressions_guest_lookup
  ON public.feed_impressions(guest_token, feed_scope, cycle_no, seen_at DESC)
  WHERE guest_token IS NOT NULL;

COMMENT ON TABLE public.feed_impressions IS 'Feed impression log per actor and cycle; used to suppress repeated regular posts.';
COMMENT ON COLUMN public.feed_impressions.post_id IS 'ID ของโพสต์ที่ actor เคยเห็นในรอบนั้น';

COMMIT;
