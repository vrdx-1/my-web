-- ปรับ trigger ให้โพสใหม่ได้รหัส 6 ตัวที่ไม่ซ้ำ (สุ่มซ้ำแล้วลองใหม่)
-- รันครั้งเดียวใน Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.cars_set_short_id()
RETURNS trigger LANGUAGE plpgsql AS $tr$
DECLARE
  new_id text;
  attempt int := 0;
  max_attempts int := 100;
BEGIN
  IF NEW.short_id IS NULL OR trim(NEW.short_id) = '' THEN
    LOOP
      new_id := public.generate_car_short_id();
      IF NOT EXISTS (SELECT 1 FROM public.cars WHERE short_id = new_id) THEN
        NEW.short_id := new_id;
        EXIT;
      END IF;
      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'ไม่สามารถสร้าง short_id ไม่ซ้ำได้หลังลอง % ครั้ง', max_attempts;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$tr$;
