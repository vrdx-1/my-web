-- Daily WhatsApp clicks in Bangkok timezone.
-- Replace :start_date and :end_date with YYYY-MM-DD strings.
select
  (created_at at time zone 'Asia/Bangkok')::date as click_date,
  count(*)::int as clicks
from public.whatsapp_click_logs
where (created_at at time zone 'Asia/Bangkok')::date between :start_date::date and :end_date::date
  and coalesce(clicker_kind, 'guest') in ('guest', 'user')
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
  and coalesce(l.clicker_kind, 'guest') in ('guest', 'user')
group by l.target_profile_id, p.username, p.is_sub_account, p.parent_admin_id
order by total_clicks desc, unique_people desc, username asc;

-- Person-unique detail by account and post for one day.
-- Replace :target_date and optionally :target_profile_id.
select
  l.target_profile_id,
  coalesce(tp.username, 'Unknown') as target_username,
  case
    when l.user_id is not null then 'user'
    else 'guest'
  end as person_type,
  l.user_id,
  l.guest_token,
  coalesce(up.username, l.guest_token, 'Guest (no token)') as person_display,
  l.post_id,
  coalesce(l.short_id, 'unknown') as short_id,
  min(coalesce(l.clicked_at, l.created_at)) as first_click_at,
  max(coalesce(l.clicked_at, l.created_at)) as last_click_at,
  count(*)::int as clicks
from public.whatsapp_click_logs l
left join public.profiles tp on tp.id = l.target_profile_id
left join public.profiles up on up.id = l.user_id
where (l.created_at at time zone 'Asia/Bangkok')::date = :target_date::date
  and coalesce(l.clicker_kind, 'guest') in ('guest', 'user')
  and (:target_profile_id::uuid is null or l.target_profile_id = :target_profile_id::uuid)
group by
  l.target_profile_id,
  tp.username,
  person_type,
  l.user_id,
  l.guest_token,
  person_display,
  l.post_id,
  short_id
order by l.target_profile_id asc, clicks desc, last_click_at desc;
