-- Disable saves counting while preserving saved-post lists.
-- Saved posts still work because the app reads from post_saves / post_saves_guest directly.
-- Run this in Supabase SQL Editor.

-- Stop any future updates to cars.saves from save tables.
DROP TRIGGER IF EXISTS trg_post_saves_after_insert ON public.post_saves;
DROP TRIGGER IF EXISTS trg_post_saves_after_delete ON public.post_saves;
DROP TRIGGER IF EXISTS trg_post_saves_guest_after_insert ON public.post_saves_guest;
DROP TRIGGER IF EXISTS trg_post_saves_guest_after_delete ON public.post_saves_guest;

-- Remove save trigger functions if they are no longer used.
DROP FUNCTION IF EXISTS public.on_save_insert();
DROP FUNCTION IF EXISTS public.on_save_delete();

-- Clear existing saved-count metrics so no stale values remain.
UPDATE public.cars
SET saves = 0
WHERE COALESCE(saves, 0) <> 0;