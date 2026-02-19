-- ============================================================
-- Migration: อนุญาต search_type = 'history' ใน search_logs
-- รันสคริปต์นี้ใน Supabase SQL Editor ครั้งเดียวเมื่อเจอ error
-- "violates check constraint search_logs_search_type_check"
-- ============================================================

ALTER TABLE public.search_logs
  DROP CONSTRAINT IF EXISTS search_logs_search_type_check;

ALTER TABLE public.search_logs
  ADD CONSTRAINT search_logs_search_type_check
  CHECK (search_type IN ('manual', 'suggestion', 'history'));
