alter table if exists public.admin_appointments
  add column if not exists potential_amount numeric(12, 2) not null default 0;
