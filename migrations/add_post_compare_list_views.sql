CREATE TABLE IF NOT EXISTS public.post_compare_list_views (
  user_id TEXT PRIMARY KEY,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_post_compare_list_views_last_viewed_at
  ON public.post_compare_list_views (last_viewed_at DESC);

COMMENT ON TABLE public.post_compare_list_views IS 'Track compare list last viewed time for unread badge counting.';

ALTER TABLE public.post_compare_list_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own compare list view state" ON public.post_compare_list_views;
CREATE POLICY "Users can view own compare list view state"
  ON public.post_compare_list_views
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.post_compare_list_views.user_id
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can create own compare list view state" ON public.post_compare_list_views;
CREATE POLICY "Users can create own compare list view state"
  ON public.post_compare_list_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.post_compare_list_views.user_id
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own compare list view state" ON public.post_compare_list_views;
CREATE POLICY "Users can update own compare list view state"
  ON public.post_compare_list_views
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.post_compare_list_views.user_id
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.post_compare_list_views.user_id
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own compare list view state" ON public.post_compare_list_views;
CREATE POLICY "Users can delete own compare list view state"
  ON public.post_compare_list_views
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.post_compare_list_views.user_id
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );
