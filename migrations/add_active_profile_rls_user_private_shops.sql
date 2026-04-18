-- ============================================================
-- Active profile RLS support for user_private_shops
-- Allows the authenticated parent account to act on behalf of a child profile
-- when user_id points to a profile whose parent_admin_id matches auth.uid().
-- ============================================================

ALTER TABLE public.user_private_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own private shops" ON public.user_private_shops;
CREATE POLICY "Users can view own private shops"
  ON public.user_private_shops
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_private_shops.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can create own private shops" ON public.user_private_shops;
CREATE POLICY "Users can create own private shops"
  ON public.user_private_shops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_private_shops.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can update own private shops" ON public.user_private_shops;
CREATE POLICY "Users can update own private shops"
  ON public.user_private_shops
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_private_shops.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_private_shops.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users can delete own private shops" ON public.user_private_shops;
CREATE POLICY "Users can delete own private shops"
  ON public.user_private_shops
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = public.user_private_shops.user_id::text
        AND public.profiles.parent_admin_id = auth.uid()::text
    )
  );
