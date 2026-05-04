-- Daily unique visitors for normal users only (admin excluded in API layer).

CREATE TABLE IF NOT EXISTS public.daily_user_visitors (
  visit_date date NOT NULL,
  user_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_user_visitors_visit_date
  ON public.daily_user_visitors (visit_date DESC);

COMMENT ON TABLE public.daily_user_visitors IS
  'เก็บผู้ใช้ที่เข้าใช้งานรายวันแบบ unique ต่อวัน (1 user ต่อ 1 วันนับ 1 ครั้ง)';

COMMENT ON COLUMN public.daily_user_visitors.visit_date IS
  'วันตาม timezone Asia/Bangkok (+07) จากฝั่ง API';
