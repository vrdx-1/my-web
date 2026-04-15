-- =============================================================================
-- Triggers: อัปเดต cars.likes อัตโนมัติเมื่อมีการ insert/delete
-- ใน post_likes และ post_likes_guest
-- Save count ถูกปิดใช้งานแล้ว เพื่อให้ระบบเก็บเฉพาะรายการที่ผู้ใช้บันทึกไว้
-- =============================================================================
-- วิธีใช้: รันใน Supabase SQL Editor
-- 1) รันส่วน "Reconciliation" ก่อน (ครั้งเดียว เพื่อให้ตัวเลขปัจจุบันตรงกับของจริง)
-- 2) รันส่วน "Trigger functions" และ "Triggers"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ส่วนที่ 1: Reconciliation (รันครั้งเดียวก่อนเปิดใช้ trigger)
-- นับจากตาราง junction จริง แล้วอัปเดต cars.likes ให้ตรง
-- -----------------------------------------------------------------------------

-- อัปเดต cars.likes จากจำนวนแถวใน post_likes + post_likes_guest
UPDATE public.cars c
SET likes = agg.cnt
FROM (
  SELECT post_id, sum(cnt)::int AS cnt
  FROM (
    SELECT post_id, count(*) AS cnt FROM public.post_likes GROUP BY post_id
    UNION ALL
    SELECT post_id, count(*) AS cnt FROM public.post_likes_guest GROUP BY post_id
  ) t
  GROUP BY post_id
) agg
WHERE c.id = agg.post_id;

-- โพสต์ที่ไม่มีแถวใน junction ให้เป็น 0
UPDATE public.cars c
SET likes = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.post_likes pl WHERE pl.post_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.post_likes_guest pg WHERE pg.post_id = c.id
);

-- -----------------------------------------------------------------------------
-- ส่วนที่ 2: Trigger functions
-- -----------------------------------------------------------------------------

-- ฟังก์ชัน: เมื่อเพิ่ม like → cars.likes + 1
CREATE OR REPLACE FUNCTION public.on_like_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cars
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

-- ฟังก์ชัน: เมื่อลบ like → cars.likes - 1 (ไม่ให้ต่ำกว่า 0)
CREATE OR REPLACE FUNCTION public.on_like_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cars
  SET likes = GREATEST(0, COALESCE(likes, 0) - 1)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

-- -----------------------------------------------------------------------------
-- ส่วนที่ 3: Triggers
-- -----------------------------------------------------------------------------

-- ลบ trigger เก่าถ้ามี (ถ้ารันซ้ำ)
DROP TRIGGER IF EXISTS trg_post_likes_after_insert ON public.post_likes;
DROP TRIGGER IF EXISTS trg_post_likes_after_delete ON public.post_likes;
DROP TRIGGER IF EXISTS trg_post_likes_guest_after_insert ON public.post_likes_guest;
DROP TRIGGER IF EXISTS trg_post_likes_guest_after_delete ON public.post_likes_guest;

-- Like: post_likes
CREATE TRIGGER trg_post_likes_after_insert
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_insert();

CREATE TRIGGER trg_post_likes_after_delete
  AFTER DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_delete();

-- Like: post_likes_guest
CREATE TRIGGER trg_post_likes_guest_after_insert
  AFTER INSERT ON public.post_likes_guest
  FOR EACH ROW EXECUTE FUNCTION public.on_like_insert();

CREATE TRIGGER trg_post_likes_guest_after_delete
  AFTER DELETE ON public.post_likes_guest
  FOR EACH ROW EXECUTE FUNCTION public.on_like_delete();
