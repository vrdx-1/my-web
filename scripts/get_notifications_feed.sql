-- Supabase SQL (run in SQL editor)
-- Purpose: Fetch notification feed + interaction summaries in ONE call
-- Usage from client:
--   supabase.rpc('get_notifications_feed', { p_owner_id: userId })

drop function if exists public.get_notifications_feed(text);

create or replace function public.get_notifications_feed(p_owner_id text)
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
  order by n.created_at desc
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
    -- Registered users: group by person_key and take latest time
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

    -- Guests: group by guest_token, avatar_url is NULL (render silhouette client-side)
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
order by n.created_at desc;
$$;

revoke all on function public.get_notifications_feed(text) from public;
grant execute on function public.get_notifications_feed(text) to authenticated;

