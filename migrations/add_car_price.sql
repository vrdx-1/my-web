-- Add car price and currency columns to cars table

ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS price BIGINT,
ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT '₭';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cars_price_nonnegative'
  ) THEN
    ALTER TABLE public.cars
    ADD CONSTRAINT cars_price_nonnegative CHECK (price IS NULL OR price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cars_price_currency_allowed'
  ) THEN
    ALTER TABLE public.cars
    ADD CONSTRAINT cars_price_currency_allowed CHECK (price_currency IN ('₭', '฿', '$'));
  END IF;
END $$;

COMMENT ON COLUMN public.cars.price IS 'Car price amount';
COMMENT ON COLUMN public.cars.price_currency IS 'Currency symbol for car price';
