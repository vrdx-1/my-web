-- Add direct USD->THB rate column for admin visibility while keeping canonical LAK pairs.

ALTER TABLE public.exchange_rates
ADD COLUMN IF NOT EXISTS usd_to_thb NUMERIC(18,6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exchange_rates_usd_to_thb_positive'
  ) THEN
    ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_usd_to_thb_positive
    CHECK (usd_to_thb IS NULL OR usd_to_thb > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.exchange_rates.usd_to_thb IS 'Derived cross-currency rate: 1 USD equals ? THB';

CREATE OR REPLACE FUNCTION public.sync_exchange_rates_usd_to_thb()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.thb_to_lak IS NULL OR NEW.thb_to_lak <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.usd_to_lak IS NULL OR NEW.usd_to_lak <= 0 THEN
    RETURN NEW;
  END IF;

  NEW.usd_to_thb := ROUND(NEW.usd_to_lak / NEW.thb_to_lak, 6);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exchange_rates_sync_usd_to_thb_trigger ON public.exchange_rates;
CREATE TRIGGER exchange_rates_sync_usd_to_thb_trigger
BEFORE INSERT OR UPDATE OF thb_to_lak, usd_to_lak
ON public.exchange_rates
FOR EACH ROW
EXECUTE FUNCTION public.sync_exchange_rates_usd_to_thb();

-- Backfill for existing rows
UPDATE public.exchange_rates
SET usd_to_thb = ROUND(usd_to_lak / NULLIF(thb_to_lak, 0), 6)
WHERE thb_to_lak > 0 AND usd_to_lak > 0;
