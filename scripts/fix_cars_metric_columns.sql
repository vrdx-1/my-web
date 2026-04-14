-- Fix missing metric columns on public.cars
-- Run this in Supabase SQL Editor, then try deleting the post again.

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares integer NOT NULL DEFAULT 0;

UPDATE public.cars
SET
  views = COALESCE(views, 0),
  likes = COALESCE(likes, 0),
  saves = COALESCE(saves, 0),
  shares = COALESCE(shares, 0);

-- After running the fix above, you can delete normally.
-- Delete one post:
-- DELETE FROM public.cars WHERE id = 'PUT-POST-ID-HERE';

-- Delete all posts:
-- DELETE FROM public.cars;
