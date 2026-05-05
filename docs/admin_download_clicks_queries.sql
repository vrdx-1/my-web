-- Daily download button clicks in Bangkok timezone.
-- Replace :start_date and :end_date with YYYY-MM-DD strings.
select
  (created_at at time zone 'Asia/Bangkok')::date as click_date,
  count(*)::int as clicks
from public.download_click_logs
where (created_at at time zone 'Asia/Bangkok')::date between :start_date::date and :end_date::date
group by 1
order by 1 asc;

-- Summary for today / month / year in Bangkok timezone.
with base as (
  select (created_at at time zone 'Asia/Bangkok')::date as click_date
  from public.download_click_logs
)
select
  count(*) filter (where click_date = (now() at time zone 'Asia/Bangkok')::date) as today_clicks,
  count(*) filter (
    where date_trunc('month', click_date) = date_trunc('month', (now() at time zone 'Asia/Bangkok')::date)
  ) as month_clicks,
  count(*) filter (
    where date_trunc('year', click_date) = date_trunc('year', (now() at time zone 'Asia/Bangkok')::date)
  ) as year_clicks
from base;
