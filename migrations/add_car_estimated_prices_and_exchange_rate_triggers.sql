-- Add estimated price columns for all supported currencies and keep them synced with exchange rates.

-- 1) Add estimated price columns on cars
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS approx_price_lak NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS approx_price_thb NUMERIC(18,2),
ADD COLUMN IF NOT EXISTS approx_price_usd NUMERIC(18,2);

COMMENT ON COLUMN public.cars.approx_price_lak IS 'Estimated post price in Lao Kip (approximation based on latest exchange rate)';
COMMENT ON COLUMN public.cars.approx_price_thb IS 'Estimated post price in Thai Baht (approximation based on latest exchange rate)';
COMMENT ON COLUMN public.cars.approx_price_usd IS 'Estimated post price in US Dollar (approximation based on latest exchange rate)';

-- 2) Ensure exchange_rates table exists (used by feed/search already)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id BIGSERIAL PRIMARY KEY,
  thb_to_lak NUMERIC(18,6) NOT NULL CHECK (thb_to_lak > 0),
  usd_to_lak NUMERIC(18,6) NOT NULL CHECK (usd_to_lak > 0),
  note TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exchange_rates_updated_at_idx
  ON public.exchange_rates (updated_at DESC, id DESC);

-- 3) Compute estimated prices for a single car row
CREATE OR REPLACE FUNCTION public.compute_car_estimated_prices(
  in_price NUMERIC,
  in_currency TEXT,
  in_thb_to_lak NUMERIC,
  in_usd_to_lak NUMERIC
)
RETURNS TABLE (
  out_lak NUMERIC,
  out_thb NUMERIC,
  out_usd NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_currency TEXT;
  safe_thb_to_lak NUMERIC := COALESCE(NULLIF(in_thb_to_lak, 0), 1);
  safe_usd_to_lak NUMERIC := COALESCE(NULLIF(in_usd_to_lak, 0), 1);
  lak NUMERIC;
BEGIN
  IF in_price IS NULL OR in_price <= 0 THEN
    RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  normalized_currency := CASE
    WHEN in_currency = '$' THEN '$'
    WHEN in_currency = '฿' THEN '฿'
    ELSE '₭'
  END;

  lak := CASE
    WHEN normalized_currency = '₭' THEN in_price
    WHEN normalized_currency = '฿' THEN in_price * safe_thb_to_lak
    WHEN normalized_currency = '$' THEN in_price * safe_usd_to_lak
    ELSE in_price
  END;

  RETURN QUERY
  SELECT
    ROUND(lak, 2),
    ROUND(lak / safe_thb_to_lak, 2),
    ROUND(lak / safe_usd_to_lak, 2);
END;
$$;

-- 4) Keep estimated columns updated when post price/currency changes
CREATE OR REPLACE FUNCTION public.set_car_estimated_prices()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rate_row RECORD;
  computed RECORD;
BEGIN
  IF NEW.price IS NULL OR NEW.price <= 0 THEN
    NEW.approx_price_lak := NULL;
    NEW.approx_price_thb := NULL;
    NEW.approx_price_usd := NULL;
    RETURN NEW;
  END IF;

  SELECT thb_to_lak, usd_to_lak
  INTO rate_row
  FROM public.exchange_rates
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  SELECT out_lak, out_thb, out_usd
  INTO computed
  FROM public.compute_car_estimated_prices(
    NEW.price::NUMERIC,
    NEW.price_currency,
    COALESCE(rate_row.thb_to_lak, 850),
    COALESCE(rate_row.usd_to_lak, 22000)
  );

  NEW.approx_price_lak := computed.out_lak;
  NEW.approx_price_thb := computed.out_thb;
  NEW.approx_price_usd := computed.out_usd;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cars_set_estimated_prices_trigger ON public.cars;
CREATE TRIGGER cars_set_estimated_prices_trigger
BEFORE INSERT OR UPDATE OF price, price_currency
ON public.cars
FOR EACH ROW
EXECUTE FUNCTION public.set_car_estimated_prices();

-- 5) Recompute all estimated prices when admin updates exchange rates
CREATE OR REPLACE FUNCTION public.refresh_all_car_estimated_prices_from_latest_rate()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  latest_thb_to_lak NUMERIC := 850;
  latest_usd_to_lak NUMERIC := 22000;
BEGIN
  SELECT thb_to_lak, usd_to_lak
  INTO latest_thb_to_lak, latest_usd_to_lak
  FROM public.exchange_rates
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  UPDATE public.cars AS c
  SET
    approx_price_lak = computed.out_lak,
    approx_price_thb = computed.out_thb,
    approx_price_usd = computed.out_usd
  FROM (
    SELECT
      id,
      (public.compute_car_estimated_prices(price::NUMERIC, price_currency, latest_thb_to_lak, latest_usd_to_lak)).*
    FROM public.cars
  ) AS computed
  WHERE c.id = computed.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_exchange_rate_changed_refresh_car_prices()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.refresh_all_car_estimated_prices_from_latest_rate();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exchange_rates_refresh_car_prices_trigger ON public.exchange_rates;
CREATE TRIGGER exchange_rates_refresh_car_prices_trigger
AFTER INSERT OR UPDATE OF thb_to_lak, usd_to_lak
ON public.exchange_rates
FOR EACH ROW
EXECUTE FUNCTION public.on_exchange_rate_changed_refresh_car_prices();

-- 6) Backfill existing posts once after migration
SELECT public.refresh_all_car_estimated_prices_from_latest_rate();
