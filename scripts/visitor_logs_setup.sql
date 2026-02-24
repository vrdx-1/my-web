-- ============================================================
-- visitor_logs: ตารางเก็บการเข้าชมเว็บ (Website Traffic)
-- ใช้โดย: VisitorTracker ใน frontend แทรกทุกครั้งที่ผู้ใช้เข้าชม (ยกเว้น /admin)
-- Admin ดูสถิติได้ที่หน้า Website Traffic
-- ============================================================

-- 1) สร้างตาราง visitor_logs (ถ้ามีอยู่แล้วจะ error; ลบหรือใช้ CREATE TABLE IF NOT EXISTS ตามที่ Supabase รองรับ)
CREATE TABLE IF NOT EXISTS public.visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  page_path text,
  user_agent text,
  is_first_visit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index สำหรับ filter ตามเวลา (ใช้ใน admin filter D/W/M/Y/A)
CREATE INDEX IF NOT EXISTS idx_visitor_logs_created_at ON public.visitor_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_visitor_id ON public.visitor_logs (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_is_first_visit ON public.visitor_logs (is_first_visit);

-- 2) เปิดใช้ RLS
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

-- 3) Policy: ให้ทุกคน (anon + authenticated) แทรกได้ — frontend VisitorTracker ใช้ anon insert
DROP POLICY IF EXISTS "Allow insert visitor_logs" ON public.visitor_logs;
CREATE POLICY "Allow insert visitor_logs"
  ON public.visitor_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4) Policy: ให้เฉพาะ Admin อ่านได้ (ตรวจจาก profiles.role = 'admin')
DROP POLICY IF EXISTS "Allow select visitor_logs for admin" ON public.visitor_logs;
CREATE POLICY "Allow select visitor_logs for admin"
  ON public.visitor_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()::text
      AND profiles.role = 'admin'
    )
  );

-- หมายเหตุ: ถ้าโปรเจกต์ใช้ service_role ใน API แทนการอ่านจาก client โดยตรง
-- สามารถเพิ่ม policy สำหรับ service_role ได้ตามต้องการ
