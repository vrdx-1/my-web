-- Supabase SQL (run in SQL editor)
-- Purpose: คืนจำนวนโพสต์ที่มี boost (boost-only notifications)
-- Usage: supabase.rpc('get_notification_unread_count', { p_owner_id: userId })

drop function if exists public.get_notification_unread_count(text);

create or replace function public.get_notification_unread_count(p_owner_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with latest_boost as (
    select distinct on (pb.post_id)
      pb.post_id,
      coalesce(pb.updated_at, pb.created_at) as event_at
    from public.post_boosts pb
    where pb.user_id::text = p_owner_id
    order by pb.post_id, coalesce(pb.updated_at, pb.created_at) desc
  ),
  not_sold as (
    select lb.post_id
    from latest_boost lb
    left join public.cars c on c.id = lb.post_id
    where c.id is null or c.status <> 'sold'
  )
  select coalesce(count(*), 0)::int
  from not_sold;
$$;

revoke all on function public.get_notification_unread_count(text) from public;
grant execute on function public.get_notification_unread_count(text) to authenticated;
