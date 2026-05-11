-- Admin Search History Queries (Guest + Normal Users only)
-- This file is for SQL history/reference in Supabase SQL editor.

-- ============================================================
-- 1) Top search terms (exclude admin/sub_admin)
-- ============================================================
SELECT
  sl.search_term,
  MAX(sl.display_text) AS display_text,
  COUNT(*)::bigint AS search_count,
  COUNT(*) FILTER (WHERE sl.search_type = 'manual')::bigint AS manual_count,
  COUNT(*) FILTER (WHERE sl.search_type = 'suggestion')::bigint AS suggestion_count,
  COUNT(*) FILTER (WHERE sl.search_type = 'history')::bigint AS history_count,
  MAX(sl.created_at) AS last_searched_at
FROM public.search_logs sl
WHERE sl.actor_role IN ('guest', 'user')
  AND sl.created_at >= NOW() - INTERVAL '30 days'
GROUP BY sl.search_term
ORDER BY search_count DESC, last_searched_at DESC
LIMIT 100;

-- ============================================================
-- 2) Recent searches with person label (exclude admin/sub_admin)
-- ============================================================
SELECT
  sl.id,
  sl.created_at,
  sl.search_term,
  COALESCE(sl.display_text, sl.search_term) AS display_text,
  sl.search_type,
  CASE
    WHEN sl.user_id IS NOT NULL THEN 'user:' || sl.user_id
    ELSE 'guest:' || COALESCE(NULLIF(sl.guest_token, ''), 'unknown')
  END AS person_key,
  CASE
    WHEN sl.user_id IS NOT NULL THEN COALESCE(NULLIF(p.full_name, ''), NULLIF(p.username, ''), 'User ' || LEFT(sl.user_id, 8))
    ELSE 'Guest ' || COALESCE(NULLIF(sl.guest_token, ''), 'unknown')
  END AS person_label,
  CASE
    WHEN sl.user_id IS NOT NULL THEN 'user'
    ELSE 'guest'
  END AS person_type
FROM public.search_logs sl
LEFT JOIN public.profiles p ON p.id = sl.user_id
WHERE sl.actor_role IN ('guest', 'user')
ORDER BY sl.created_at DESC
LIMIT 300;

-- ============================================================
-- 3) Person leaderboard (exclude admin/sub_admin)
-- ============================================================
SELECT
  CASE
    WHEN sl.user_id IS NOT NULL THEN 'user:' || sl.user_id
    ELSE 'guest:' || COALESCE(NULLIF(sl.guest_token, ''), 'unknown')
  END AS person_key,
  CASE
    WHEN sl.user_id IS NOT NULL THEN COALESCE(NULLIF(p.full_name, ''), NULLIF(p.username, ''), 'User ' || LEFT(sl.user_id, 8))
    ELSE 'Guest ' || COALESCE(NULLIF(sl.guest_token, ''), 'unknown')
  END AS person_label,
  CASE
    WHEN sl.user_id IS NOT NULL THEN 'user'
    ELSE 'guest'
  END AS person_type,
  COUNT(*)::int AS total_searches,
  MAX(sl.created_at) AS last_searched_at
FROM public.search_logs sl
LEFT JOIN public.profiles p ON p.id = sl.user_id
WHERE sl.actor_role IN ('guest', 'user')
GROUP BY person_key, person_label, person_type
ORDER BY total_searches DESC, last_searched_at DESC
LIMIT 200;

-- ============================================================
-- 4) Account-bound history for one profile (cross-device)
-- ============================================================
-- Replace :profile_id with actual profile id.
SELECT
  h.search_term,
  h.display_text,
  h.last_search_type,
  h.search_count,
  h.last_searched_at
FROM public.user_search_history h
WHERE h.user_id = :profile_id
ORDER BY h.last_searched_at DESC
LIMIT 20;
