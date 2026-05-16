-- WhatsApp source selection for admin sub accounts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number_source TEXT NOT NULL DEFAULT 'self';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_whatsapp_number_source_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_whatsapp_number_source_check
      CHECK (whatsapp_number_source IN ('self', 'admin'));
  END IF;
END $$;

UPDATE public.profiles
SET whatsapp_number_source = 'self'
WHERE whatsapp_number_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number_source
  ON public.profiles (parent_admin_id, whatsapp_number_source)
  WHERE is_sub_account = TRUE;

COMMENT ON COLUMN public.profiles.whatsapp_number_source
IS 'Determines whether a sub account uses its own WhatsApp number (self) or inherits the parent admin number (admin).';