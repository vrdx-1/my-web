-- RPC สำหรับค้นหาโพสจาก caption ตามหลายคำ (ไทย/ลาว/อังกฤษ) ใน DB โดยไม่ผ่าน URL
-- รันใน Supabase SQL Editor: ใช้เมื่อมีหลายคำค้น เพื่อให้ค้นภาษาอังกฤษได้ผลครบ 3 ภาษา

CREATE OR REPLACE FUNCTION public.search_cars_by_caption_terms(
  p_terms text[],
  p_start int DEFAULT 0,
  p_limit int DEFAULT 300
)
RETURNS TABLE(id uuid, is_boosted boolean, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.is_boosted, c.created_at
  FROM cars c
  WHERE c.status = 'recommend'
    AND (c.is_hidden = false OR c.is_hidden IS NULL)
    AND EXISTS (
      SELECT 1 FROM unnest(p_terms) AS t
      WHERE t IS NOT NULL AND trim(t) <> '' AND c.caption ILIKE '%' || t || '%'
    )
  ORDER BY c.is_boosted DESC NULLS LAST, c.created_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_start;
END;
$$;

-- เปิดให้ anon/authenticated เรียกได้
GRANT EXECUTE ON FUNCTION public.search_cars_by_caption_terms(text[], int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.search_cars_by_caption_terms(text[], int, int) TO authenticated;

COMMENT ON FUNCTION public.search_cars_by_caption_terms IS 'Feed search by caption: OR match any of p_terms (Thai/Lao/English), with pagination.';
