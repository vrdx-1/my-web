-- แปลง short_id ทุกแถวในตาราง cars เป็นตัวเลข 6 ตัว
-- ต้องรัน cars_short_id_6_digits_only.sql ก่อน (ให้ฟังก์ชันสร้างรหัส 6 หลัก)
-- รันใน Supabase SQL Editor

DO $migrate$
DECLARE
  r RECORD;
  new_id text;
  max_attempts int := 100;
  attempt int;
BEGIN
  FOR r IN SELECT id FROM public.cars
  LOOP
    attempt := 0;
    LOOP
      new_id := public.generate_car_short_id();
      IF NOT EXISTS (SELECT 1 FROM public.cars WHERE short_id = new_id AND id != r.id) THEN
        UPDATE public.cars SET short_id = new_id WHERE id = r.id;
        EXIT;
      END IF;
      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'ไม่สามารถสร้าง short_id ไม่ซ้ำสำหรับ car id % ได้หลังลอง % ครั้ง', r.id, max_attempts;
      END IF;
    END LOOP;
  END LOOP;
END;
$migrate$;
