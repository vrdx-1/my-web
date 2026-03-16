-- อัปเดตฟังก์ชันให้สร้างรหัสตัวเลข 6 ตัวเท่านั้น (รันชุดนี้ชิ้นเดียวใน Supabase SQL Editor)
CREATE OR REPLACE FUNCTION public.generate_car_short_id()
RETURNS text LANGUAGE plpgsql VOLATILE AS $fn$
BEGIN
  RETURN (floor(random()*10)::int)::text || (floor(random()*10)::int)::text || (floor(random()*10)::int)::text || (floor(random()*10)::int)::text || (floor(random()*10)::int)::text || (floor(random()*10)::int)::text;
END;
$fn$;
