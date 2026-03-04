-- แก้ RLS ตาราง cars ให้การค้นหา (และอ่านโพส) แสดงทั้ง "พร้อมขาย" และ "ขายแล้ว"
-- รันใน Supabase SQL Editor
-- สำคัญ: อย่าลบ policy เดิมที่ใช้อยู่จนกว่าจะรันขั้นที่ 3 สำเร็จ และทดสอบค้นหาได้แล้ว

-- ขั้นที่ 1: ดูนโยบาย SELECT ปัจจุบัน (รันแยกแล้วเช็คว่ามี policy อะไรบ้าง)
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'cars' AND cmd = 'SELECT';

-- ขั้นที่ 2: ไม่ต้องลบ policy เดิม — ให้มีหลาย policy ได้ (ระบบจะใช้ OR กัน)

-- ขั้นที่ 3: เพิ่มนโยบายให้ anon / authenticated อ่านโพส (พร้อมขาย หรือ ขายแล้ว) ที่ไม่ซ่อน
DROP POLICY IF EXISTS "Allow read recommend and sold cars" ON public.cars;
CREATE POLICY "Allow read recommend and sold cars"
  ON public.cars
  FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'recommend' OR status = 'sold')
    AND (COALESCE(is_hidden, false) = false)
  );

-- ----- กู้คืน: ถ้าค้นหาอะไรก็ไม่ขึ้น (ไม่มีผลลัพธ์เลย) ให้รันบล็อกด้านล่างใน SQL Editor -----
-- สาเหตุอาจเป็น: ไม่มี policy ใดให้ anon อ่าน cars ได้ หรือ policy เดิมถูกลบไป
-- รันทีละบล็อก:

-- 3.1 ดูว่ามี policy อะไรบน cars บ้าง
-- SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'cars';

-- 3.2 ถ้าไม่มี policy สำหรับ SELECT เลย ให้สร้าง policy ชั่วคราวที่อนุญาตอ่านทั้งหมด (ใช้ทดสอบ)
-- DROP POLICY IF EXISTS "Allow read cars for feed" ON public.cars;
-- CREATE POLICY "Allow read cars for feed"
--   ON public.cars FOR SELECT TO anon, authenticated
--   USING (true);

-- 3.3 หลังค้นหาขึ้นแล้ว แนะนำให้ลบ "Allow read cars for feed" แล้วใช้แค่ "Allow read recommend and sold cars" (ขั้นที่ 3 ด้านบน) เพื่อความปลอดภัย
-- DROP POLICY IF EXISTS "Allow read cars for feed" ON public.cars;
