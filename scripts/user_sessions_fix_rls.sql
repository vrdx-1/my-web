-- แก้ RLS ให้ insert user_sessions ได้ (รันใน Supabase SQL Editor)
-- ใช้เมื่อเจอ error: new row violates row-level security policy

-- สิทธิระดับตาราง (anon ต้องได้ INSERT ถึงจะถึงขั้น RLS)
GRANT INSERT, UPDATE ON public.user_sessions TO anon;
GRANT INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT SELECT ON public.user_sessions TO authenticated;

-- Policy ให้ anon/authenticated แทรกแถวได้
DROP POLICY IF EXISTS "Allow insert user_sessions" ON public.user_sessions;
CREATE POLICY "Allow insert user_sessions"
  ON public.user_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
