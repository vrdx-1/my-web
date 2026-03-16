-- เติม short_id ให้โพสเก่าทุกแถว และบังคับไม่ให้รหัสซ้ำ
-- รันใน Supabase SQL Editor หลังรัน cars_short_id.sql แล้ว

-- 1) เติม short_id ให้แถวที่ยังเป็น NULL (สุ่มจนได้รหัสที่ไม่ซ้ำกับแถวอื่น)
DO $$
DECLARE
  r RECORD;
  new_id text;
  max_attempts int := 100;
  attempt int;
BEGIN
  FOR r IN SELECT id FROM public.cars WHERE short_id IS NULL OR trim(short_id) = ''
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
$$;

-- 2) บังคับไม่ให้มีรหัสซ้ำ (สร้าง unique index)
-- ลบ constraint เดิมถ้ามี แล้วสร้างใหม่
DROP INDEX IF EXISTS public.cars_short_id_unique;
CREATE UNIQUE INDEX cars_short_id_unique ON public.cars (short_id) WHERE short_id IS NOT NULL;

-- 3) ปรับ trigger ให้โพสใหม่ได้รหัสที่ไม่ซ้ำ (สุ่มซ้ำแล้วลองใหม่)
CREATE OR REPLACE FUNCTION public.cars_set_short_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;
