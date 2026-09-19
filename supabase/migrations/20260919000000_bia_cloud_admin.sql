create extension if not exists pgcrypto;

create table if not exists public.bia_cloud_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Novo atendimento Mercado Livre',
  status text not null default 'active',
  facts text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bia_cloud_cases_status_check check (status in ('active', 'waiting', 'resolved', 'cancelled'))
);

create table if not exists public.bia_cloud_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.bia_cloud_cases(id) on delete cascade,
  role text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint bia_cloud_messages_role_check check (role in ('operator', 'assistant', 'system'))
);

create table if not exists public.bia_cloud_memories (
  id uuid primary key default gen_random_uuid(),
  memory_key text not null unique,
  instruction text not null,
  source text not null default 'operator',
  active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bia_cloud_cases_updated_at_idx on public.bia_cloud_cases(updated_at desc);
create index if not exists bia_cloud_messages_case_created_idx on public.bia_cloud_messages(case_id, created_at asc);

drop trigger if exists set_bia_cloud_cases_updated_at on public.bia_cloud_cases;
create trigger set_bia_cloud_cases_updated_at before update on public.bia_cloud_cases
for each row execute function public.set_updated_at();

drop trigger if exists set_bia_cloud_memories_updated_at on public.bia_cloud_memories;
create trigger set_bia_cloud_memories_updated_at before update on public.bia_cloud_memories
for each row execute function public.set_updated_at();

insert into public.bia_cloud_memories (memory_key, instruction, source)
values
  ('ml_whatsapp_hub_submit', 'No hub oficial do Mercado Livre, se o formulário de WhatsApp já estiver aberto e o número estiver preenchido, não voltar etapas: acionar o botão disponível, inclusive quando o texto for “Mandem para esse número”.', 'migration'),
  ('ml_transient_control_retry', 'Controle temporariamente indisponível não exige reinício do fluxo: permanecer na tela atual, aguardar e tentar novamente antes de escalar.', 'migration')
on conflict (memory_key) do nothing;

alter table public.bia_cloud_cases enable row level security;
alter table public.bia_cloud_messages enable row level security;
alter table public.bia_cloud_memories enable row level security;
