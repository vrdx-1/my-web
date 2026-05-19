-- Track detailed clicker identity on whatsapp_click_logs.
-- This keeps admin/sub-account events in DB, while dashboards can filter them out.

ALTER TABLE public.whatsapp_click_logs
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS clicker_kind text NOT NULL DEFAULT 'guest',
  ADD COLUMN IF NOT EXISTS clicker_role text NULL,
  ADD COLUMN IF NOT EXISTS clicker_is_sub_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clicker_parent_admin_id text NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_click_logs_clicker_kind_check'
  ) THEN
    ALTER TABLE public.whatsapp_click_logs
      ADD CONSTRAINT whatsapp_click_logs_clicker_kind_check
      CHECK (clicker_kind IN ('guest', 'user', 'admin', 'admin_sub_account'));
  END IF;
END $$;

-- Keep historical timestamp aligned with legacy created_at for old rows.
UPDATE public.whatsapp_click_logs
SET clicked_at = created_at
WHERE clicked_at IS NULL;

-- Backfill clicker metadata from profiles.
UPDATE public.whatsapp_click_logs AS w
SET
  clicker_role = p.role,
  clicker_is_sub_account = COALESCE(p.is_sub_account, false),
  clicker_parent_admin_id = p.id,
  clicker_kind = CASE
    WHEN w.user_id IS NULL THEN 'guest'
    WHEN p.role = 'admin' THEN 'admin'
    WHEN COALESCE(p.is_sub_account, false) = true AND p.parent_admin_id IS NOT NULL THEN 'admin_sub_account'
    ELSE 'user'
  END
FROM public.profiles AS p
WHERE w.user_id = p.id::uuid;

-- If user exists but profile no longer exists, keep as generic user click.
UPDATE public.whatsapp_click_logs
SET clicker_kind = 'user'
WHERE user_id IS NOT NULL
  AND clicker_kind = 'guest';

CREATE INDEX IF NOT EXISTS idx_whatsapp_click_logs_clicker_kind
  ON public.whatsapp_click_logs (clicker_kind, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_click_logs_target_profile_clicked_at
  ON public.whatsapp_click_logs (target_profile_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_click_logs_clicker_parent_admin
  ON public.whatsapp_click_logs (clicker_parent_admin_id)
  WHERE clicker_parent_admin_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_click_logs.clicked_at
IS 'Server timestamp when WhatsApp button was clicked.';

COMMENT ON COLUMN public.whatsapp_click_logs.clicker_kind
IS 'Click actor class: guest, user, admin, or admin_sub_account.';

COMMENT ON COLUMN public.whatsapp_click_logs.clicker_role
IS 'Snapshot of profile.role at click time.';

COMMENT ON COLUMN public.whatsapp_click_logs.clicker_is_sub_account
IS 'Snapshot flag of whether clicker profile was a sub account at click time.';

COMMENT ON COLUMN public.whatsapp_click_logs.clicker_parent_admin_id
IS 'Snapshot of parent admin id when click was made by a sub account.';
