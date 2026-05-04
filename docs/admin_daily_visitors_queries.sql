-- Admin Daily Visitors: reference queries
-- This file is for easy recall/manual checking in Supabase SQL editor.

-- 1) Daily unique visitors (users + guests) latest 90 days, including days with 0
WITH days AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '89 day')::date,
    CURRENT_DATE::date,
    INTERVAL '1 day'
  )::date AS visit_date
),
users_per_day AS (
  SELECT visit_date, COUNT(*)::int AS unique_users
  FROM public.daily_user_visitors
  GROUP BY visit_date
),
guests_per_day AS (
  SELECT visit_date, COUNT(*)::int AS unique_guests
  FROM public.daily_guest_visitors
  GROUP BY visit_date
)
SELECT
  d.visit_date,
  COALESCE(u.unique_users, 0) AS unique_users,
  COALESCE(g.unique_guests, 0) AS unique_guests,
  COALESCE(u.unique_users, 0) + COALESCE(g.unique_guests, 0) AS unique_total
FROM days d
LEFT JOIN users_per_day u ON u.visit_date = d.visit_date
LEFT JOIN guests_per_day g ON g.visit_date = d.visit_date
ORDER BY d.visit_date DESC;

-- 2) Today's unique visitors breakdown
SELECT
  (SELECT COUNT(*)::int FROM public.daily_user_visitors WHERE visit_date = CURRENT_DATE) AS today_unique_users,
  (SELECT COUNT(*)::int FROM public.daily_guest_visitors WHERE visit_date = CURRENT_DATE) AS today_unique_guests,
  (
    (SELECT COUNT(*)::int FROM public.daily_user_visitors WHERE visit_date = CURRENT_DATE)
    +
    (SELECT COUNT(*)::int FROM public.daily_guest_visitors WHERE visit_date = CURRENT_DATE)
  ) AS today_unique_total;

-- 3) Total unique visitors in selected range (edit dates as needed)
SELECT
  (SELECT COUNT(*)::int FROM public.daily_user_visitors WHERE visit_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31') AS total_unique_users_in_range,
  (SELECT COUNT(*)::int FROM public.daily_guest_visitors WHERE visit_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31') AS total_unique_guests_in_range,
  (
    (SELECT COUNT(*)::int FROM public.daily_user_visitors WHERE visit_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
    +
    (SELECT COUNT(*)::int FROM public.daily_guest_visitors WHERE visit_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
  ) AS total_unique_visitors_in_range;
