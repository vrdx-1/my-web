-- Daily WhatsApp clicks in Bangkok timezone.
-- Replace :start_date and :end_date with YYYY-MM-DD strings.
select
  (created_at at time zone 'Asia/Bangkok')::date as click_date,
  count(*)::int as clicks
from public.whatsapp_click_logs
where (created_at at time zone 'Asia/Bangkok')::date between :start_date::date and :end_date::date
group by 1
order by 1 asc;

-- Account breakdown for one day in Bangkok timezone.
-- Replace :target_date with a YYYY-MM-DD string.
select
  l.target_profile_id,
  coalesce(p.username, 'Unknown') as username,
  coalesce(p.is_sub_account, false) as is_sub_account,
  p.parent_admin_id,
  count(*)::int as total_clicks,
  count(distinct case
    when l.user_id is not null then 'u:' || l.user_id::text
    when l.guest_token is not null and l.guest_token <> '' then 'g:' || l.guest_token
    else 'log:' || l.id::text
  end)::int as unique_people,
  count(*) filter (where l.user_id is not null)::int as user_clicks,
  count(*) filter (where l.user_id is null)::int as guest_clicks
from public.whatsapp_click_logs l
left join public.profiles p on p.id = l.target_profile_id
where (l.created_at at time zone 'Asia/Bangkok')::date = :target_date::date
group by l.target_profile_id, p.username, p.is_sub_account, p.parent_admin_id
order by total_clicks desc, unique_people desc, username asc;
