-- ============================================================
-- user_sessions: ตารางเก็บ Session การเข้าชมเว็บ (User Sessions)
-- ใช้โดย: VisitorTracker บันทึก session เริ่ม + จบ (duration)
-- Admin ดูได้ที่หน้า User Sessions (Registered User / Guest User)
-- ============================================================

-- 0) ถ้ามีตารางอยู่แล้ว: เพิ่มคอลัมน์ last_seen_at ก่อน (รันก่อนทุกอย่าง)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_sessions') THEN
    ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;
  END IF;
END $$;

-- 1) สร้างตาราง user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  visitor_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  duration_seconds integer NULL,
  last_seen_at timestamptz NULL
);

COMMENT ON COLUMN public.user_sessions.user_id IS 'NULL = Guest; มีค่า = Registered user (auth.users.id)';
COMMENT ON COLUMN public.user_sessions.visitor_id IS 'จาก localStorage ใช้ร่วมกับ visitor_logs';
COMMENT ON COLUMN public.user_sessions.duration_seconds IS 'คำนวณเมื่อ session จบ: EXTRACT(EPOCH FROM (ended_at - started_at))';
COMMENT ON COLUMN public.user_sessions.last_seen_at IS 'อัปเดตจาก heartbeat ทุก ~30s ใช้ปิด session ค้าง (cron)';

-- Index สำหรับ filter ตามเวลา และแยก Registered / Guest
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_visitor_id ON public.user_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ended_at ON public.user_sessions (ended_at) WHERE ended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen_at ON public.user_sessions (last_seen_at) WHERE last_seen_at IS NOT NULL;

-- 2) เปิดใช้ RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 3) Policy: ให้ anon + authenticated แทรกได้ (frontend บันทึก session เริ่ม)
DROP POLICY IF EXISTS "Allow insert user_sessions" ON public.user_sessions;
CREATE POLICY "Allow insert user_sessions"
  ON public.user_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4) Policy: ให้ anon + authenticated อัปเดตได้ (frontend ส่ง session end)
DROP POLICY IF EXISTS "Allow update user_sessions" ON public.user_sessions;
CREATE POLICY "Allow update user_sessions"
  ON public.user_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5) Policy: ให้เฉพาะ Admin อ่านได้
DROP POLICY IF EXISTS "Allow select user_sessions for admin" ON public.user_sessions;
CREATE POLICY "Allow select user_sessions for admin"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()::text
      AND profiles.role = 'admin'
    )
  );

-- 6) ฟังก์ชันปิด session ค้าง (ended_at IS NULL และ last_seen_at/started_at เก่ากว่า N นาที)
-- เรียกจาก cron API ด้วย service_role
CREATE OR REPLACE FUNCTION public.close_stale_user_sessions(stale_minutes integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.user_sessions
  SET
    ended_at = COALESCE(last_seen_at, now()),
    duration_seconds = (EXTRACT(EPOCH FROM (COALESCE(last_seen_at, now()) - started_at)))::integer
  WHERE ended_at IS NULL
    AND (
      (last_seen_at IS NOT NULL AND last_seen_at < now() - (stale_minutes || ' minutes')::interval)
      OR (last_seen_at IS NULL AND started_at < now() - (stale_minutes || ' minutes')::interval)
    );
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
COMMENT ON FUNCTION public.close_stale_user_sessions(integer) IS 'ปิด session ที่ ended_at IS NULL และไม่มีการ heartbeat เกิน stale_minutes นาที';
