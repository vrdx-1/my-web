-- ============================================================
-- user_sessions: ตารางเก็บ Session การเข้าชมเว็บ (User Sessions)
-- ใช้โดย: VisitorTracker บันทึก session เริ่ม + จบ (duration)
-- Admin ดูได้ที่หน้า User Sessions (Registered User / Guest User)
-- ============================================================

-- 1) สร้างตาราง user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  visitor_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  duration_seconds integer NULL
);

COMMENT ON COLUMN public.user_sessions.user_id IS 'NULL = Guest; มีค่า = Registered user (auth.users.id)';
COMMENT ON COLUMN public.user_sessions.visitor_id IS 'จาก localStorage ใช้ร่วมกับ visitor_logs';
COMMENT ON COLUMN public.user_sessions.duration_seconds IS 'คำนวณเมื่อ session จบ: EXTRACT(EPOCH FROM (ended_at - started_at))';

-- Index สำหรับ filter ตามเวลา และแยก Registered / Guest
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_visitor_id ON public.user_sessions (visitor_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ended_at ON public.user_sessions (ended_at) WHERE ended_at IS NOT NULL;

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
