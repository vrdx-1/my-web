-- Remove per-user identity tracking from search_logs while preserving aggregate search stats.

DROP POLICY IF EXISTS "Authenticated can adopt guest logs" ON public.search_logs;

DROP INDEX IF EXISTS public.idx_search_logs_guest_token_user;
DROP INDEX IF EXISTS public.idx_search_logs_guest_token;
DROP INDEX IF EXISTS public.idx_search_logs_user_id;

ALTER TABLE public.search_logs
  DROP COLUMN IF EXISTS guest_token,
  DROP COLUMN IF EXISTS user_id;

COMMENT ON TABLE public.search_logs IS 'ประวัติการค้นหาแบบ anonymous (manual, suggestion, history=กดจากประวัติการค้นหา) สำหรับ Admin ดูสถิติ';