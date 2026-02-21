-- =============================================================================
-- ตาราง car_edits: บันทึกเมื่อ User แก้ไขโพส (caption / province / images)
-- ใช้สำหรับหน้า Admin "Review (Edited)" แสดงโพสที่แก้ไขภายใน 24 ชั่วโมง
-- =============================================================================
-- วิธีใช้: รันใน Supabase SQL Editor
-- =============================================================================

-- ตาราง car_edits
CREATE TABLE IF NOT EXISTS public.car_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_edits_edited_at ON public.car_edits(edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_edits_car_id ON public.car_edits(car_id);

COMMENT ON TABLE public.car_edits IS 'Records when a post (car) is edited by user; used for admin Review (Edited) 24h list';

-- Trigger: เมื่อมีการอัปเดต caption, province หรือ images ใน cars ให้ insert แถวใหม่ใน car_edits
CREATE OR REPLACE FUNCTION public.car_edits_on_cars_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.car_edits (car_id, edited_at) VALUES (NEW.id, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_car_edits_after_update ON public.cars;
CREATE TRIGGER tr_car_edits_after_update
  AFTER UPDATE ON public.cars
  FOR EACH ROW
  WHEN (
    OLD.caption IS DISTINCT FROM NEW.caption
    OR OLD.province IS DISTINCT FROM NEW.province
    OR OLD.images IS DISTINCT FROM NEW.images
  )
  EXECUTE PROCEDURE public.car_edits_on_cars_update();

-- RLS: service role สำหรับ API admin; authenticated ต้อง INSERT ได้เมื่อ trigger จากการแก้โพส
ALTER TABLE public.car_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access car_edits"
  ON public.car_edits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert car_edits"
  ON public.car_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
