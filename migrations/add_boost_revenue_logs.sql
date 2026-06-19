-- Revenue ledger for boost income recognition and reversals.
-- This migration is idempotent and safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.revenue_logs (
  id bigserial PRIMARY KEY,
  source_type text NOT NULL DEFAULT 'boost_post',
  source_boost_id text,
  post_id text,
  payer_user_id text,
  payer_role_snapshot text,
  payer_is_sub_account_snapshot boolean NOT NULL DEFAULT false,
  payer_parent_admin_id_snapshot text,
  event_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'LAK',
  event_at timestamptz NOT NULL DEFAULT now(),
  reason_code text,
  note text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_logs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'boost_post',
  ADD COLUMN IF NOT EXISTS source_boost_id text,
  ADD COLUMN IF NOT EXISTS post_id text,
  ADD COLUMN IF NOT EXISTS payer_user_id text,
  ADD COLUMN IF NOT EXISTS payer_role_snapshot text,
  ADD COLUMN IF NOT EXISTS payer_is_sub_account_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payer_parent_admin_id_snapshot text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'LAK',
  ADD COLUMN IF NOT EXISTS event_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE public.revenue_logs
SET event_type = COALESCE(event_type, 'boost_revenue_recognized')
WHERE event_type IS NULL;

UPDATE public.revenue_logs
SET amount = 0
WHERE amount IS NULL;

ALTER TABLE public.revenue_logs
  ALTER COLUMN event_type SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'revenue_logs_event_type_check'
  ) THEN
    ALTER TABLE public.revenue_logs
      ADD CONSTRAINT revenue_logs_event_type_check
      CHECK (event_type IN ('boost_revenue_recognized', 'boost_revenue_reversed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'revenue_logs_event_amount_sign_check'
  ) THEN
    ALTER TABLE public.revenue_logs
      ADD CONSTRAINT revenue_logs_event_amount_sign_check
      CHECK (
        (event_type = 'boost_revenue_recognized' AND amount >= 0)
        OR
        (event_type = 'boost_revenue_reversed' AND amount <= 0)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_revenue_logs_boost_event
  ON public.revenue_logs (source_boost_id, event_type);

CREATE INDEX IF NOT EXISTS idx_revenue_logs_created_at
  ON public.revenue_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_logs_source_boost_id
  ON public.revenue_logs (source_boost_id)
  WHERE source_boost_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_logs_post_id
  ON public.revenue_logs (post_id)
  WHERE post_id IS NOT NULL;

COMMENT ON TABLE public.revenue_logs
IS 'Ledger events for boost revenue recognition and reversals.';

COMMENT ON COLUMN public.revenue_logs.event_type
IS 'boost_revenue_recognized or boost_revenue_reversed.';

COMMENT ON COLUMN public.revenue_logs.amount
IS 'Signed amount in LAK: positive for recognition, negative for reversal.';
