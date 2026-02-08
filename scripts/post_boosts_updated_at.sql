-- รันใน Supabase SQL Editor ตามลำดับ

-- 1) เพิ่มคอลัมน์ updated_at ถ้ายังไม่มี (รันครั้งเดียว)
alter table public.post_boosts
  add column if not exists updated_at timestamptz default now();

-- อัปเดตแถวเก่าให้มีค่า (ถ้าเพิ่งเพิ่มคอลัมน์)
update public.post_boosts
  set updated_at = created_at
  where updated_at is null;

-- 2) ฟังก์ชัน + trigger ให้อัปเดต updated_at ทุกครั้งที่แถวเปลี่ยน
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists post_boosts_updated_at on public.post_boosts;
create trigger post_boosts_updated_at
  before update on public.post_boosts
  for each row execute function public.set_updated_at();
