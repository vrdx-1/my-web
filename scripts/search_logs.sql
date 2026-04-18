-- ============================================================
-- ตาราง search_logs สำหรับเก็บประวัติการค้นหาทั้งหมดของ User
-- เก็บทุกการค้นหา ทั้งจาก suggestion หรือพิมพ์ค้นหาเอง
-- ============================================================

-- 1) สร้างตาราง (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term TEXT NOT NULL,
  display_text TEXT,
  search_type TEXT NOT NULL CHECK (search_type IN ('manual', 'suggestion', 'history')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index สำหรับเรียงตามเวลาและสรุปสถิติ
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_search_term ON public.search_logs(search_term);
CREATE INDEX IF NOT EXISTS idx_search_logs_search_type ON public.search_logs(search_type);

-- Index สำหรับนับจำนวนครั้งที่ค้นหา (สำหรับสถิติ)
CREATE INDEX IF NOT EXISTS idx_search_logs_term_count ON public.search_logs(search_term, created_at DESC);

-- Comment
COMMENT ON TABLE public.search_logs IS 'ประวัติการค้นหาแบบ anonymous (manual, suggestion, history=กดจากประวัติการค้นหา) สำหรับ Admin ดูสถิติ';

-- อัปเดต constraint สำหรับ DB ที่มีอยู่แล้ว ให้รับค่า 'history'
ALTER TABLE public.search_logs DROP CONSTRAINT IF EXISTS search_logs_search_type_check;
ALTER TABLE public.search_logs ADD CONSTRAINT search_logs_search_type_check CHECK (search_type IN ('manual', 'suggestion', 'history'));

-- 2) เปิด RLS (Row Level Security)
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- 3) Policy: ทุกคน (ทั้ง authenticated และ anon) สามารถบันทึกการค้นหาได้
DROP POLICY IF EXISTS "Anyone can insert search logs" ON public.search_logs;
CREATE POLICY "Anyone can insert search logs"
  ON public.search_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 4) Policy: ผู้ใช้ที่ล็อกอินสามารถอ่านประวัติการค้นหาทั้งหมดได้
--    (ข้อมูลนี้จะถูกใช้ในหน้า Admin เป็นหลัก)
DROP POLICY IF EXISTS "Users can select own search logs" ON public.search_logs;
DROP POLICY IF EXISTS "Authenticated can read all search logs" ON public.search_logs;
CREATE POLICY "Authenticated can read all search logs"
  ON public.search_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- 5) Policy: Admin ต้องดูทั้งหมดได้ (จะใช้ผ่าน API route ที่ใช้ service_role key หรือ admin client)
--    สำหรับหน้า admin จะใช้ API route ที่ bypass RLS

-- ============================================================
-- Function สำหรับนับจำนวนครั้งที่ค้นหาแต่ละคำ (สำหรับสถิติ)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_search_term_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  search_term TEXT,
  display_text TEXT,
  search_count BIGINT,
  manual_count BIGINT,
  suggestion_count BIGINT,
  history_count BIGINT,
  last_searched_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.search_term,
    MAX(sl.display_text) as display_text,
    COUNT(*)::BIGINT as search_count,
    COUNT(*) FILTER (WHERE sl.search_type = 'manual')::BIGINT as manual_count,
    COUNT(*) FILTER (WHERE sl.search_type = 'suggestion')::BIGINT as suggestion_count,
    COUNT(*) FILTER (WHERE sl.search_type = 'history')::BIGINT as history_count,
    MAX(sl.created_at) as last_searched_at
  FROM search_logs sl
  WHERE 
    (p_start_date IS NULL OR sl.created_at >= p_start_date)
    AND (p_end_date IS NULL OR sl.created_at <= p_end_date)
  GROUP BY sl.search_term
  ORDER BY search_count DESC, last_searched_at DESC
  LIMIT p_limit;
END;
$$;

-- เปิดให้ authenticated และ anon เรียกได้ (แต่จะใช้ผ่าน admin API route ที่ใช้ service_role)
GRANT EXECUTE ON FUNCTION public.get_search_term_stats(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_search_term_stats(TIMESTAMPTZ, TIMESTAMPTZ, INT) TO anon;

COMMENT ON FUNCTION public.get_search_term_stats IS 'นับจำนวนครั้งที่ค้นหาแต่ละคำ พร้อมแยกประเภท manual/suggestion/history';
