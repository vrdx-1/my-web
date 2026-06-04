-- Backfill approx_price_lak so price filters relying on this column can return real rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'refresh_all_car_estimated_prices_from_latest_rate'
  ) THEN
    PERFORM public.refresh_all_car_estimated_prices_from_latest_rate();
  END IF;
END;
$$;

WITH latest_rates AS (
  SELECT
    COALESCE(thb_to_lak, CASE WHEN lak_to_thb > 0 THEN 1 / lak_to_thb ELSE NULL END, 850) AS thb_to_lak,
    COALESCE(usd_to_lak, CASE WHEN lak_to_usd > 0 THEN 1 / lak_to_usd ELSE NULL END, 22000) AS usd_to_lak
  FROM public.exchange_rates
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
), normalized_rates AS (
  SELECT
    COALESCE(thb_to_lak, 850)::numeric AS thb_to_lak,
    COALESCE(usd_to_lak, 22000)::numeric AS usd_to_lak
  FROM latest_rates
  UNION ALL
  SELECT 850::numeric, 22000::numeric
  WHERE NOT EXISTS (SELECT 1 FROM latest_rates)
)
UPDATE public.cars AS c
SET approx_price_lak = CASE
  WHEN c.price_currency = '$' THEN c.price::numeric * r.usd_to_lak
  WHEN c.price_currency = '฿' THEN c.price::numeric * r.thb_to_lak
  ELSE c.price::numeric
END
FROM (SELECT thb_to_lak, usd_to_lak FROM normalized_rates LIMIT 1) AS r
WHERE c.price IS NOT NULL
  AND c.price::numeric > 0
  AND (c.approx_price_lak IS NULL OR c.approx_price_lak <= 0);

CREATE INDEX IF NOT EXISTS cars_approx_price_lak_idx
  ON public.cars (approx_price_lak)
  WHERE approx_price_lak IS NOT NULL;
