-- Account-bound search history + actor-aware search logs
-- Requirement:
-- 1) Search history is tied to account (cross-device)
-- 2) Admin analytics can exclude admin/sub-admin actors
-- 3) Keep guest visibility for analytics

BEGIN;

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS user_id TEXT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS actor_role TEXT NOT NULL DEFAULT 'guest';

ALTER TABLE public.search_logs
  DROP CONSTRAINT IF EXISTS search_logs_actor_role_check;

ALTER TABLE public.search_logs
  ADD CONSTRAINT search_logs_actor_role_check
  CHECK (actor_role IN ('guest', 'user', 'admin', 'sub_admin'));

CREATE INDEX IF NOT EXISTS idx_search_logs_user_id
  ON public.search_logs(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_logs_guest_token
  ON public.search_logs(guest_token)
  WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_logs_actor_role
  ON public.search_logs(actor_role);

COMMENT ON COLUMN public.search_logs.user_id IS 'Profile id of actor when logged in (includes admin/sub account).';
COMMENT ON COLUMN public.search_logs.guest_token IS 'Device-level guest token for anonymous actors.';
COMMENT ON COLUMN public.search_logs.actor_role IS 'Actor category at search time: guest, user, admin, sub_admin.';

CREATE TABLE IF NOT EXISTS public.user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  term_key TEXT NOT NULL,
  search_term TEXT NOT NULL,
  display_text TEXT,
  last_search_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (last_search_type IN ('manual', 'suggestion', 'history')),
  search_count INTEGER NOT NULL DEFAULT 1,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, term_key)
);

CREATE INDEX IF NOT EXISTS idx_user_search_history_user_last
  ON public.user_search_history(user_id, last_searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_search_history_term_key
  ON public.user_search_history(term_key);

COMMENT ON TABLE public.user_search_history IS 'Account-bound search history for cross-device experience.';

ALTER TABLE public.user_search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own search history" ON public.user_search_history;
CREATE POLICY "Users read own search history"
  ON public.user_search_history
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_search_history.user_id
        AND p.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users upsert own search history" ON public.user_search_history;
CREATE POLICY "Users upsert own search history"
  ON public.user_search_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_search_history.user_id
        AND p.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users update own search history" ON public.user_search_history;
CREATE POLICY "Users update own search history"
  ON public.user_search_history
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_search_history.user_id
        AND p.parent_admin_id = auth.uid()::text
    )
  )
  WITH CHECK (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_search_history.user_id
        AND p.parent_admin_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Users delete own search history" ON public.user_search_history;
CREATE POLICY "Users delete own search history"
  ON public.user_search_history
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_search_history.user_id
        AND p.parent_admin_id = auth.uid()::text
    )
  );

COMMIT;
