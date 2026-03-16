-- ໃຫ້ shop_name ແລະ shop_phone ເປັນ NULL ได้ (ຜູ້ໃຊ້ອາດກອກແຕ່ໂນດ ຫຼື ແຕ່ເບີ)
-- ຮັນ Supabase: ເປີດ SQL Editor ແລ້ວ run script ນີ້

ALTER TABLE public.user_private_shops
  ALTER COLUMN shop_name DROP NOT NULL,
  ALTER COLUMN shop_phone DROP NOT NULL;
