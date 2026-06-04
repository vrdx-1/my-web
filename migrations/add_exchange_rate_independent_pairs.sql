-- Independent exchange-rate pairs for LAK/THB/USD.
-- Admin can update each pair directly without auto-sync to other pairs.

ALTER TABLE public.exchange_rates
ADD COLUMN IF NOT EXISTS lak_to_thb NUMERIC(18,6),
ADD COLUMN IF NOT EXISTS lak_to_usd NUMERIC(18,6),
ADD COLUMN IF NOT EXISTS thb_to_usd NUMERIC(18,6),
ADD COLUMN IF NOT EXISTS usd_to_thb NUMERIC(18,6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_lak_to_thb_positive'
  ) THEN
    ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_lak_to_thb_positive CHECK (lak_to_thb IS NULL OR lak_to_thb > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_lak_to_usd_positive'
  ) THEN
    ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_lak_to_usd_positive CHECK (lak_to_usd IS NULL OR lak_to_usd > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_thb_to_usd_positive'
  ) THEN
    ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_thb_to_usd_positive CHECK (thb_to_usd IS NULL OR thb_to_usd > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_usd_to_thb_positive'
  ) THEN
    ALTER TABLE public.exchange_rates
    ADD CONSTRAINT exchange_rates_usd_to_thb_positive CHECK (usd_to_thb IS NULL OR usd_to_thb > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.exchange_rates.lak_to_thb IS 'Independent rate: 1 LAK = ? THB';
COMMENT ON COLUMN public.exchange_rates.lak_to_usd IS 'Independent rate: 1 LAK = ? USD';
COMMENT ON COLUMN public.exchange_rates.thb_to_usd IS 'Independent rate: 1 THB = ? USD';
COMMENT ON COLUMN public.exchange_rates.usd_to_thb IS 'Independent rate: 1 USD = ? THB';

-- Backfill new columns from existing values only when null.
UPDATE public.exchange_rates
SET
  lak_to_thb = COALESCE(lak_to_thb, CASE WHEN thb_to_lak > 0 THEN ROUND(1 / thb_to_lak, 6) ELSE NULL END),
  lak_to_usd = COALESCE(lak_to_usd, CASE WHEN usd_to_lak > 0 THEN ROUND(1 / usd_to_lak, 6) ELSE NULL END),
  thb_to_usd = COALESCE(thb_to_usd, CASE WHEN usd_to_lak > 0 THEN ROUND(thb_to_lak / usd_to_lak, 6) ELSE NULL END),
  usd_to_thb = COALESCE(usd_to_thb, CASE WHEN thb_to_lak > 0 THEN ROUND(usd_to_lak / thb_to_lak, 6) ELSE NULL END)
WHERE TRUE;

-- Disable previous auto-sync trigger to keep all pairs independent.
DROP TRIGGER IF EXISTS exchange_rates_sync_usd_to_thb_trigger ON public.exchange_rates;
DROP FUNCTION IF EXISTS public.sync_exchange_rates_usd_to_thb();

-- Rework car estimated-price calculator to use independent pair rates directly.
CREATE OR REPLACE FUNCTION public.compute_car_estimated_prices_v2(
  in_price NUMERIC,
  in_currency TEXT,
  in_lak_to_thb NUMERIC,
  in_lak_to_usd NUMERIC,
  in_thb_to_lak NUMERIC,
  in_thb_to_usd NUMERIC,
  in_usd_to_lak NUMERIC,
  in_usd_to_thb NUMERIC
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

  IF normalized_currency = '₭' THEN
    RETURN QUERY SELECT
      ROUND(in_price, 2),
      ROUND(in_price * in_lak_to_thb, 2),
      ROUND(in_price * in_lak_to_usd, 2);
    RETURN;
  END IF;

  IF normalized_currency = '฿' THEN
    RETURN QUERY SELECT
      ROUND(in_price * in_thb_to_lak, 2),
      ROUND(in_price, 2),
      ROUND(in_price * in_thb_to_usd, 2);
    RETURN;
  END IF;

  RETURN QUERY SELECT
    ROUND(in_price * in_usd_to_lak, 2),
    ROUND(in_price * in_usd_to_thb, 2),
    ROUND(in_price, 2);
END;
$$;

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

  SELECT lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb
  INTO rate_row
  FROM public.exchange_rates
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  SELECT out_lak, out_thb, out_usd
  INTO computed
  FROM public.compute_car_estimated_prices_v2(
    NEW.price::NUMERIC,
    NEW.price_currency,
    COALESCE(rate_row.lak_to_thb, 1 / 850.0),
    COALESCE(rate_row.lak_to_usd, 1 / 22000.0),
    COALESCE(rate_row.thb_to_lak, 850),
    COALESCE(rate_row.thb_to_usd, 850.0 / 22000.0),
    COALESCE(rate_row.usd_to_lak, 22000),
    COALESCE(rate_row.usd_to_thb, 22000.0 / 850.0)
  );

  NEW.approx_price_lak := computed.out_lak;
  NEW.approx_price_thb := computed.out_thb;
  NEW.approx_price_usd := computed.out_usd;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_car_estimated_prices_from_latest_rate()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  rates RECORD;
BEGIN
  SELECT lak_to_thb, lak_to_usd, thb_to_lak, thb_to_usd, usd_to_lak, usd_to_thb
  INTO rates
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
      (public.compute_car_estimated_prices_v2(
        price::NUMERIC,
        price_currency,
        COALESCE(rates.lak_to_thb, 1 / 850.0),
        COALESCE(rates.lak_to_usd, 1 / 22000.0),
        COALESCE(rates.thb_to_lak, 850),
        COALESCE(rates.thb_to_usd, 850.0 / 22000.0),
        COALESCE(rates.usd_to_lak, 22000),
        COALESCE(rates.usd_to_thb, 22000.0 / 850.0)
      )).*
    FROM public.cars
  ) AS computed
  WHERE c.id = computed.id;
END;
$$;

-- Backfill with the new independent-pair logic
SELECT public.refresh_all_car_estimated_prices_from_latest_rate();
