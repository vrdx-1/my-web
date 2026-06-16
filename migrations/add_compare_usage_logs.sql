BEGIN;

CREATE TABLE IF NOT EXISTS public.compare_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  post_id UUID NULL REFERENCES public.cars(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compare_usage_logs_user_created_at
  ON public.compare_usage_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compare_usage_logs_post_created_at
  ON public.compare_usage_logs (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compare_usage_logs_created_at
  ON public.compare_usage_logs (created_at DESC);

COMMENT ON TABLE public.compare_usage_logs IS 'Append-only log for user compare-button usage in PostCard menu.';
COMMENT ON COLUMN public.compare_usage_logs.user_id IS 'Profile id of the actor who clicked compare.';
COMMENT ON COLUMN public.compare_usage_logs.post_id IS 'Post id that was added to compare.';

ALTER TABLE public.compare_usage_logs ENABLE ROW LEVEL SECURITY;

COMMIT;