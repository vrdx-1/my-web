-- ============================================================
-- ตาราง user_problem_reports สำหรับเก็บรายงานปัญหาจาก User
-- เนื้อหา: ข้อความ + แนบรูปภาพได้ (เก็บเป็น array ของ URL)
-- ============================================================

-- 1) สร้างตาราง
CREATE TABLE IF NOT EXISTS public.user_problem_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  image_urls TEXT[] DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index สำหรับดึงตาม user_id และเรียงตามเวลา
CREATE INDEX IF NOT EXISTS idx_user_problem_reports_user_id ON public.user_problem_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_problem_reports_created_at ON public.user_problem_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_problem_reports_status ON public.user_problem_reports(status);

-- Comment
COMMENT ON TABLE public.user_problem_reports IS 'รายงานปัญหาจากผู้ใช้ (ข้อความ + รูป) สำหรับให้ Admin ดู';

-- 2) เปิด RLS (Row Level Security)
ALTER TABLE public.user_problem_reports ENABLE ROW LEVEL SECURITY;

-- 3) Policy: ผู้ใช้ที่ล็อกอินเท่านั้นที่ insert ได้ และต้องเป็น user_id ของตัวเอง
CREATE POLICY "Users can insert own problem report"
  ON public.user_problem_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) Policy: ผู้ใช้ดูได้เฉพาะรายงานของตัวเอง
CREATE POLICY "Users can select own problem reports"
  ON public.user_problem_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5) Policy: Admin ต้องดูทั้งหมดได้ผ่าน Service Role หรือ API ที่ใช้ service_role key
--    (ถ้าใช้ anon key ในแอป Admin ให้สร้าง API route ที่ใช้ SUPABASE_SERVICE_ROLE_KEY แทน)

-- อัปเดต updated_at เมื่อแก้ไข (optional)
CREATE OR REPLACE FUNCTION public.set_user_problem_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_problem_reports_updated_at ON public.user_problem_reports;
CREATE TRIGGER trigger_user_problem_reports_updated_at
  BEFORE UPDATE ON public.user_problem_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_problem_reports_updated_at();

-- ============================================================
-- Storage bucket สำหรับรูปแนบรายงานปัญหา
-- ============================================================
-- ถ้า INSERT ด้านล่างไม่ผ่าน (ไม่มีสิทธิ์แก้ storage.buckets) ให้สร้าง bucket เองใน Dashboard:
-- Storage > New bucket > Name: report-images > Public: เปิด
-- จากนั้นรันเฉพาะส่วน Policy ด้านล่าง (CREATE POLICY สำหรับ report-images)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-images',
  'report-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: ผู้ใช้ที่ล็อกอินอัปโหลดได้เฉพาะโฟลเดอร์ของตัวเอง (path ขึ้นต้นด้วย user_id)
CREATE POLICY "Users can upload report images in own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: ทุกคนอ่านได้ (public bucket) เพื่อให้รูปแสดงในแอป/แอดมิน
CREATE POLICY "Public read report images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'report-images');

-- Policy: ผู้ใช้ลบได้เฉพาะไฟล์ในโฟลเดอร์ของตัวเอง (optional)
CREATE POLICY "Users can delete own report images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'report-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
