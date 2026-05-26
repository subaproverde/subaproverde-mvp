create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_clients (
  id text primary key default ('cli_' || replace(gen_random_uuid()::text, '-', '')),
  name text not null default '',
  document text not null default '',
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_removals (
  id text primary key default ('rem_' || replace(gen_random_uuid()::text, '-', '')),
  client_id text not null references public.admin_clients(id) on update cascade on delete restrict,
  seller_id text null,
  ml_order_id text null,
  pack_id text null,
  claim_id text null,
  shipment_id text null,
  impact_type text not null default 'reclamacao',
  status text not null default 'pendente',
  title text not null default '',
  description text not null default '',
  charged_amount numeric(12, 2) not null default 0,
  success boolean null,
  service_date date not null default current_date,
  due_date date not null default current_date,
  completed_at date null,
  report_notes text not null default '',
  internal_notes text not null default '',
  evidence_links text[] not null default '{}',
  priority text not null default 'media',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_removals_impact_type_check check (
    impact_type in ('reclamacao', 'atraso', 'cancelamento', 'mediacao', 'outro')
  ),
  constraint admin_removals_status_check check (
    status in ('pendente', 'em_andamento', 'removido', 'nao_removido', 'aguardando_cliente', 'finalizado')
  ),
  constraint admin_removals_priority_check check (priority in ('alta', 'media', 'baixa'))
);

create table if not exists public.admin_removal_events (
  id text primary key default ('evt_' || replace(gen_random_uuid()::text, '-', '')),
  removal_id text not null references public.admin_removals(id) on update cascade on delete cascade,
  event_type text not null default 'nota',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_appointments (
  id text primary key default ('apt_' || replace(gen_random_uuid()::text, '-', '')),
  client_id text not null references public.admin_clients(id) on update cascade on delete restrict,
  title text not null default '',
  type text not null default 'tarefa',
  status text not null default 'agendado',
  scheduled_date date not null default current_date,
  scheduled_time text not null default '09:00',
  duration_minutes integer not null default 30,
  potential_amount numeric(12, 2) not null default 0,
  priority text not null default 'media',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_appointments_type_check check (
    type in ('tarefa', 'defesa', 'follow_up', 'relatorio', 'cobranca', 'diagnostico')
  ),
  constraint admin_appointments_status_check check (
    status in ('agendado', 'confirmado', 'em_atendimento', 'concluido', 'remarcar')
  ),
  constraint admin_appointments_priority_check check (priority in ('alta', 'media', 'baixa')),
  constraint admin_appointments_duration_check check (duration_minutes > 0)
);

drop trigger if exists set_admin_clients_updated_at on public.admin_clients;
create trigger set_admin_clients_updated_at
before update on public.admin_clients
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_removals_updated_at on public.admin_removals;
create trigger set_admin_removals_updated_at
before update on public.admin_removals
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_appointments_updated_at on public.admin_appointments;
create trigger set_admin_appointments_updated_at
before update on public.admin_appointments
for each row execute function public.set_updated_at();

alter table public.admin_clients enable row level security;
alter table public.admin_removals enable row level security;
alter table public.admin_removal_events enable row level security;
alter table public.admin_appointments enable row level security;

drop policy if exists "Admins manage admin clients" on public.admin_clients;
create policy "Admins manage admin clients"
on public.admin_clients
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage admin removals" on public.admin_removals;
create policy "Admins manage admin removals"
on public.admin_removals
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage admin removal events" on public.admin_removal_events;
create policy "Admins manage admin removal events"
on public.admin_removal_events
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage admin appointments" on public.admin_appointments;
create policy "Admins manage admin appointments"
on public.admin_appointments
for all
using (public.is_admin())
with check (public.is_admin());

create index if not exists admin_removals_client_id_idx on public.admin_removals(client_id);
create index if not exists admin_removals_status_idx on public.admin_removals(status);
create index if not exists admin_removals_service_date_idx on public.admin_removals(service_date);
create index if not exists admin_removals_due_date_idx on public.admin_removals(due_date);
create index if not exists admin_appointments_client_id_idx on public.admin_appointments(client_id);
create index if not exists admin_appointments_scheduled_date_idx on public.admin_appointments(scheduled_date);
