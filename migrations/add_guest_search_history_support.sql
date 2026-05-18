BEGIN;

ALTER TABLE public.user_search_history
  ADD COLUMN IF NOT EXISTS guest_token TEXT NULL;

ALTER TABLE public.user_search_history
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.user_search_history
  DROP CONSTRAINT IF EXISTS user_search_history_user_id_term_key_key;

ALTER TABLE public.user_search_history
  DROP CONSTRAINT IF EXISTS user_search_history_actor_check;

ALTER TABLE public.user_search_history
  ADD CONSTRAINT user_search_history_actor_check
  CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL)
    OR (user_id IS NULL AND guest_token IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_search_history_user_term_unique
  ON public.user_search_history(user_id, term_key)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_search_history_guest_term_unique
  ON public.user_search_history(guest_token, term_key)
  WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_search_history_guest_last
  ON public.user_search_history(guest_token, last_searched_at DESC)
  WHERE guest_token IS NOT NULL;

COMMENT ON COLUMN public.user_search_history.guest_token IS 'Device-level guest token for anonymous search history.';

COMMIT;