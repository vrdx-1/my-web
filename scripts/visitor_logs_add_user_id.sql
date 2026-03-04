-- เพิ่มคอลัมน์ user_id ใน visitor_logs เพื่อแยกรายการเข้าชมของผู้ใช้ลงทะเบียน vs แขก
-- รันใน Supabase SQL Editor ถ้าตารางยังไม่มี user_id

ALTER TABLE public.visitor_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_visitor_logs_user_id ON public.visitor_logs (user_id);
