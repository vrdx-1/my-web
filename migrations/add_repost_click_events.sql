BEGIN;

CREATE TABLE IF NOT EXISTS public.repost_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repost_click_events_post_id
  ON public.repost_click_events (post_id);

CREATE INDEX IF NOT EXISTS idx_repost_click_events_user_id
  ON public.repost_click_events (user_id);

CREATE INDEX IF NOT EXISTS idx_repost_click_events_post_user
  ON public.repost_click_events (post_id, user_id);

COMMENT ON TABLE public.repost_click_events IS 'Append-only log of repost clicks from PostCard menu (user-only, excludes admin actors at API layer).';
COMMENT ON COLUMN public.repost_click_events.post_id IS 'Post that was reposted.';
COMMENT ON COLUMN public.repost_click_events.user_id IS 'Profile id of the actor who clicked repost.';
COMMENT ON COLUMN public.repost_click_events.clicked_at IS 'Timestamp when repost action was confirmed.';

ALTER TABLE public.repost_click_events ENABLE ROW LEVEL SECURITY;

COMMIT;
