-- คอลัมน์ short_id: รหัสโพส 6 ตัว (ตัวเลขล้วน) ใช้แสดงในการ์ดและค้นหา
-- รันใน Supabase SQL Editor

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS short_id text;

COMMENT ON COLUMN public.cars.short_id IS 'Post display ID: 6 digits (e.g. 123456)';

-- สร้างรหัส 6 ตัว: ตัวเลข 0-9 จำนวน 6 ตัว
CREATE OR REPLACE FUNCTION public.generate_car_short_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  RETURN (floor(random() * 10)::int)::text
    || (floor(random() * 10)::int)::text
    || (floor(random() * 10)::int)::text
    || (floor(random() * 10)::int)::text
    || (floor(random() * 10)::int)::text
    || (floor(random() * 10)::int)::text;
END;
$$;

-- Trigger: ก่อน insert ถ้า short_id เป็น null ให้สุ่มให้
CREATE OR REPLACE FUNCTION public.cars_set_short_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_id IS NULL OR trim(NEW.short_id) = '' THEN
    NEW.short_id := public.generate_car_short_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cars_set_short_id ON public.cars;
CREATE TRIGGER tr_cars_set_short_id
  BEFORE INSERT ON public.cars
  FOR EACH ROW
  EXECUTE PROCEDURE public.cars_set_short_id();

-- (ถ้าต้องการให้แถวเก่ามี short_id ให้รันอัปเดตแยก เช่น:
-- UPDATE public.cars SET short_id = public.generate_car_short_id() WHERE short_id IS NULL;
-- อาจต้องรันหลายรอบถ้าต้องการให้ short_id ไม่ซ้ำ และเพิ่ม UNIQUE ภายหลัง)
