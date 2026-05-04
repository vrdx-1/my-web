-- Daily unique visitors for guest users (not logged in)

CREATE TABLE IF NOT EXISTS public.daily_guest_visitors (
  visit_date date NOT NULL,
  guest_token text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_date, guest_token)
);

CREATE INDEX IF NOT EXISTS idx_daily_guest_visitors_visit_date
  ON public.daily_guest_visitors (visit_date DESC);

COMMENT ON TABLE public.daily_guest_visitors IS
  'เก็บผู้ใช้ guest ที่เข้าใช้งานรายวันแบบ unique ต่อวัน (1 guest token ต่อ 1 วันนับ 1 ครั้ง)';

COMMENT ON COLUMN public.daily_guest_visitors.visit_date IS
  'วันตาม timezone Asia/Bangkok (+07) จากฝั่ง API';
