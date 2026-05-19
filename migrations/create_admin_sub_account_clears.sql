-- Track admin-sub-account manual clear actions separately from sold status.
-- This keeps the "cleared" tab independent from cars.status = 'sold'.

CREATE TABLE IF NOT EXISTS public.admin_sub_account_clears (
  id BIGSERIAL PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sub_account_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, car_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sub_account_clears_admin_sub
  ON public.admin_sub_account_clears (admin_id, sub_account_id, cleared_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_sub_account_clears_car
  ON public.admin_sub_account_clears (car_id);
