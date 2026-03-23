-- Supabase SQL (run in SQL editor)
-- Purpose: Fetch boost-only notification feed
-- Keyset pagination (cursor) by boost event timestamp + post_id
-- Usage from client:
--   หน้าแรก: supabase.rpc('get_notifications_feed', { p_owner_id: userId, p_limit: 20 })
--   หน้าถัดไป: supabase.rpc('get_notifications_feed', { p_owner_id: userId, p_limit: 20, p_after_created_at: "2024-...", p_after_id: "post_id" })

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
  p_after_id text default null
)
returns table (
  id text,
  post_id text,
  created_at timestamptz,
  type text,
  username text,
  avatar_url text,
  car_data jsonb
)
language sql
stable
security definer
set search_path = public
as $$
with boost_latest as (
  select distinct on (pb.post_id)
    pb.post_id::text as post_id,
    coalesce(pb.updated_at, pb.created_at) as created_at,
    pb.status,
    pb.expires_at
  from public.post_boosts pb
  where pb.user_id::text = p_owner_id
  order by pb.post_id, coalesce(pb.updated_at, pb.created_at) desc
),
boost_with_car as (
  select
    b.post_id,
    b.created_at,
    b.status,
    b.expires_at,
    c.caption,
    c.images,
    c.status as car_status
  from boost_latest b
  left join public.cars c on c.id::text = b.post_id
),
filtered as (
  select *
  from boost_with_car
  where coalesce(car_status, '') <> 'sold'
  and (
    (p_after_created_at is null and p_after_id is null)
    or (created_at, post_id) < (p_after_created_at, p_after_id)
  )
)
select
  post_id as id,
  post_id,
  created_at,
  'boost'::text as type,
  'ລະບົບ'::text as username,
  null::text as avatar_url,
  jsonb_build_object(
    'caption', coalesce(caption, ''),
    'images', to_jsonb(coalesce(images, '{}'::text[])),
    'boost_status', status,
    'boost_expires_at', expires_at
  ) as car_data
from filtered
order by created_at desc, post_id desc
limit case when p_limit is not null and p_limit > 0 then p_limit else null end;
$$;

-- ========== สิทธิ์ (ฟังก์ชันมี 4 พารามิเตอร์, เรียกแค่ 2 ตัวก็ได้ เพราะมี default) ==========
revoke all on function public.get_notifications_feed(text, int, timestamptz, text) from public;
grant execute on function public.get_notifications_feed(text, int, timestamptz, text) to authenticated;
