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

-- 4) Daily visit events (session-level entries) latest 90 days
WITH days AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '89 day')::date,
    CURRENT_DATE::date,
    INTERVAL '1 day'
  )::date AS visit_date
),
events_per_day AS (
  SELECT
    visit_date,
    COUNT(*)::int AS visit_events_total,
    COUNT(*) FILTER (WHERE actor_type = 'user')::int AS visit_events_users,
    COUNT(*) FILTER (WHERE actor_type = 'guest')::int AS visit_events_guests
  FROM public.visitor_visit_logs
  GROUP BY visit_date
)
SELECT
  d.visit_date,
  COALESCE(e.visit_events_total, 0) AS visit_events_total,
  COALESCE(e.visit_events_users, 0) AS visit_events_users,
  COALESCE(e.visit_events_guests, 0) AS visit_events_guests
FROM days d
LEFT JOIN events_per_day e ON e.visit_date = d.visit_date
ORDER BY d.visit_date DESC;

-- 5) Per-person detail for one day
SELECT
  actor_type,
  actor_key,
  user_id,
  guest_token,
  COUNT(*)::int AS visit_count,
  MIN(visited_at) AS first_visit_at,
  MAX(visited_at) AS last_visit_at
FROM public.visitor_visit_logs
WHERE visit_date = DATE '2026-06-17'
GROUP BY actor_type, actor_key, user_id, guest_token
ORDER BY visit_count DESC, last_visit_at DESC;
