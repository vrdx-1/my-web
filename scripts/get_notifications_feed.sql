-- Supabase SQL (run in SQL editor)
-- Purpose: Fetch notification feed + interaction summaries in ONE call
-- Keyset pagination (cursor) แทน OFFSET เพื่อให้ทุกหน้าโหลดเร็วเท่ากัน
-- Usage from client:
--   หน้าแรก: supabase.rpc('get_notifications_feed', { p_owner_id: userId, p_limit: 20 })
--   หน้าถัดไป: supabase.rpc('get_notifications_feed', { p_owner_id: userId, p_limit: 20, p_after_created_at: "2024-...", p_after_id: "uuid" })

-- ========== ลบ Function เก่าทุกแบบ (ทุก overload) ==========
drop function if exists public.get_notifications_feed(text);
drop function if exists public.get_notifications_feed(text, int);
drop function if exists public.get_notifications_feed(text, int, int);
drop function if exists public.get_notifications_feed(text, int, timestamptz, uuid);

-- ========== สร้าง Function ใหม่ (4 พารามิเตอร์, ตัวที่ 3–4 มี default) ==========
create or replace function public.get_notifications_feed(
  p_owner_id text,
  p_limit int default null,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table (
  id uuid,
  post_id uuid,
  created_at timestamptz,
  type text,
  username text,
  avatar_url text,
  car_data jsonb,
  likes_count int,
  saves_count int,
  interaction_total int,
  interaction_avatars text[]
)
language sql
stable
security definer
set search_path = public
as $$
with notifs as (
  select
    n.id,
    n.post_id,
    n.created_at,
    n.type,
    n.username,
    n.avatar_url,
    n.car_data
  from public.all_notifications n
  where n.owner_id::text = p_owner_id
  and (
    (p_after_created_at is null and p_after_id is null)
    or (n.created_at, n.id) < (p_after_created_at, p_after_id)
  )
  order by n.created_at desc, n.id desc
  limit case when p_limit is not null and p_limit > 0 then p_limit else null end
),
post_ids as (
  select distinct post_id from notifs
),
likes_user as (
  select post_id, count(*)::int as cnt
  from public.post_likes
  where post_id in (select post_id from post_ids)
  group by post_id
),
likes_guest as (
  select post_id, count(*)::int as cnt
  from public.post_likes_guest
  where post_id in (select post_id from post_ids)
  group by post_id
),
saves_user as (
  select post_id, count(*)::int as cnt
  from public.post_saves
  where post_id in (select post_id from post_ids)
  group by post_id
),
saves_guest as (
  select post_id, count(*)::int as cnt
  from public.post_saves_guest
  where post_id in (select post_id from post_ids)
  group by post_id
),
interaction_people as (
  select
    p.post_id,
    count(*)::int as interaction_total,
    array_agg(p.avatar_url order by p.last_time desc) as interaction_avatars
  from (
    select
      u.post_id,
      max(u.created_at) as last_time,
      max(pr.avatar_url)::text as avatar_url
    from (
      select post_id, user_id, created_at
      from public.post_likes
      where post_id in (select post_id from post_ids)
      union all
      select post_id, user_id, created_at
      from public.post_saves
      where post_id in (select post_id from post_ids)
    ) u
    left join public.profiles pr on pr.id = u.user_id
    group by u.post_id, u.user_id
    union all
    select
      g.post_id,
      max(g.created_at) as last_time,
      null::text as avatar_url
    from (
      select post_id, guest_token, created_at
      from public.post_likes_guest
      where post_id in (select post_id from post_ids)
      union all
      select post_id, guest_token, created_at
      from public.post_saves_guest
      where post_id in (select post_id from post_ids)
    ) g
    group by g.post_id, g.guest_token
  ) p
  group by p.post_id
)
select
  n.id,
  n.post_id,
  n.created_at,
  n.type,
  n.username,
  n.avatar_url,
  n.car_data,
  coalesce(lu.cnt, 0) + coalesce(lg.cnt, 0) as likes_count,
  coalesce(su.cnt, 0) + coalesce(sg.cnt, 0) as saves_count,
  coalesce(ip.interaction_total, 0) as interaction_total,
  coalesce(ip.interaction_avatars, '{}'::text[]) as interaction_avatars
from notifs n
left join likes_user lu on lu.post_id = n.post_id
left join likes_guest lg on lg.post_id = n.post_id
left join saves_user su on su.post_id = n.post_id
left join saves_guest sg on sg.post_id = n.post_id
left join interaction_people ip on ip.post_id = n.post_id
order by n.created_at desc, n.id desc;
$$;

-- ========== สิทธิ์ (ฟังก์ชันมี 4 พารามิเตอร์, เรียกแค่ 2 ตัวก็ได้ เพราะมี default) ==========
revoke all on function public.get_notifications_feed(text, int, timestamptz, uuid) from public;
grant execute on function public.get_notifications_feed(text, int, timestamptz, uuid) to authenticated;
