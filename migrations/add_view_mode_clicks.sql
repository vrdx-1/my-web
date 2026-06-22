-- Track the display-mode toggle clicks separately for Saved and My Posts.
-- Only normal user profiles are recorded; admin and sub-account activity is skipped by the API layer.

CREATE TABLE IF NOT EXISTS public.saved_view_mode_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.my_posts_view_mode_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_view_mode_clicks_user_id
  ON public.saved_view_mode_clicks (user_id);

CREATE INDEX IF NOT EXISTS idx_saved_view_mode_clicks_created_at
  ON public.saved_view_mode_clicks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_my_posts_view_mode_clicks_user_id
  ON public.my_posts_view_mode_clicks (user_id);

CREATE INDEX IF NOT EXISTS idx_my_posts_view_mode_clicks_created_at
  ON public.my_posts_view_mode_clicks (created_at DESC);

COMMENT ON TABLE public.saved_view_mode_clicks IS 'Append-only log of compact/expanded toggle clicks from the Saved page.';
COMMENT ON TABLE public.my_posts_view_mode_clicks IS 'Append-only log of compact/expanded toggle clicks from the My Posts page.';

ALTER TABLE public.saved_view_mode_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.my_posts_view_mode_clicks ENABLE ROW LEVEL SECURITY;