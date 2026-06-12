-- =========================================================
-- Migration: add_latest_post_first_to_filter_search_logs
-- เพิ่มคอลัมน์เก็บการใช้ตัวกรอง "โพสใหม่ล่าสุดก่อน"
-- ใช้ร่วมกับตาราง filter_search_logs (guest/user เท่านั้น ตาม logic เดิมใน API)
-- =========================================================

ALTER TABLE public.filter_search_logs
  ADD COLUMN IF NOT EXISTS latest_post_first BOOLEAN NULL;

ALTER TABLE public.filter_search_logs
  DROP CONSTRAINT IF EXISTS fsl_latest_post_first_true;

ALTER TABLE public.filter_search_logs
  ADD CONSTRAINT fsl_latest_post_first_true
  CHECK (latest_post_first IS NULL OR latest_post_first = TRUE);

ALTER TABLE public.filter_search_logs
  DROP CONSTRAINT IF EXISTS fsl_at_least_one_filter;

ALTER TABLE public.filter_search_logs
  ADD CONSTRAINT fsl_at_least_one_filter CHECK (
    province IS NOT NULL
    OR min_price_kip IS NOT NULL
    OR max_price_kip IS NOT NULL
    OR (price_sort_order IS NOT NULL AND price_sort_order <> '')
    OR latest_post_first IS TRUE
  );

CREATE INDEX IF NOT EXISTS idx_fsl_latest_post_first
  ON public.filter_search_logs (latest_post_first)
  WHERE latest_post_first IS TRUE;

COMMENT ON COLUMN public.filter_search_logs.latest_post_first IS 'TRUE when user selected latest posts first filter.';
