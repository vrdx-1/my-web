-- Supabase SQL (run in SQL editor)
-- Purpose: คืนจำนวน "โพสต์ที่มีแจ้งเตือนยังไม่อ่าน" เฉพาะตัวเลข ไม่ดึงรายการ (ใช้สำหรับ badge)
-- Usage: supabase.rpc('get_notification_unread_count', { p_owner_id: userId })

drop function if exists public.get_notification_unread_count(text);

create or replace function public.get_notification_unread_count(p_owner_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(distinct n.post_id), 0)::int
  from public.all_notifications n
  where n.owner_id::text = p_owner_id
  and not exists (
    select 1 from public.notification_reads r
    where r.user_id::text = p_owner_id and r.notification_id = n.id
  );
$$;

revoke all on function public.get_notification_unread_count(text) from public;
grant execute on function public.get_notification_unread_count(text) to authenticated;
