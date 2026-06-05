-- =========================================================
-- Migration: add_filter_search_logs
-- สร้างตาราง filter_search_logs สำหรับเก็บประวัติการใช้ตัวกรอง (filter)
-- เก็บเฉพาะ Guest และ User ทั่วไปเท่านั้น (ไม่รวม admin / sub_admin)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.filter_search_logs (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  -- ผู้ใช้ที่ล็อกอิน (NULL ถ้าเป็น guest)
  user_id       TEXT          NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- token อุปกรณ์ของ guest (NULL ถ้าเป็น user)
  guest_token   TEXT          NULL,
  -- บทบาทของผู้ค้นหา: 'guest' หรือ 'user' เท่านั้น
  actor_role    TEXT          NOT NULL CHECK (actor_role IN ('guest', 'user')),
  -- ตัวกรองที่เลือก (NULL = ไม่ได้เลือกตัวกรองนั้น)
  province      TEXT          NULL,
  min_price_kip BIGINT        NULL,
  max_price_kip BIGINT        NULL,
  -- สกุลเงินที่ผู้ใช้เลือกแสดงราคาในหน้า filter ('₭' / '$' / '฿')
  display_currency TEXT        NULL CHECK (display_currency IN ('₭', '$', '฿')),
  -- '' = ไม่ได้เรียง, 'asc' = ถูกสุดก่อน, 'desc' = แพงสุดก่อน
  price_sort_order TEXT       NULL CHECK (price_sort_order IN ('asc', 'desc', '')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- ต้องมีแค่หนึ่งใน user_id หรือ guest_token เท่านั้น
  CONSTRAINT fsl_actor_xor CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL)
    OR
    (user_id IS NULL AND guest_token IS NOT NULL)
  ),
  -- ต้องมีตัวกรองอย่างน้อย 1 ตัว
  CONSTRAINT fsl_at_least_one_filter CHECK (
    province IS NOT NULL
    OR min_price_kip IS NOT NULL
    OR max_price_kip IS NOT NULL
    OR (price_sort_order IS NOT NULL AND price_sort_order <> '')
  )
);

-- Indexes สำหรับ query ที่ใช้บ่อย
CREATE INDEX IF NOT EXISTS idx_fsl_created_at
  ON public.filter_search_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fsl_user_id
  ON public.filter_search_logs (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsl_guest_token
  ON public.filter_search_logs (guest_token)
  WHERE guest_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsl_province
  ON public.filter_search_logs (province)
  WHERE province IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsl_actor_role
  ON public.filter_search_logs (actor_role);

-- เปิด RLS — ห้าม client เข้าถึงโดยตรง ใช้ service role เท่านั้น
ALTER TABLE public.filter_search_logs ENABLE ROW LEVEL SECURITY;
