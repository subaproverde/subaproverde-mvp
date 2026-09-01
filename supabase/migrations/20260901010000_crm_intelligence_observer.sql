create table if not exists public.crm_ai_runs (
  id text primary key default ('air_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  source_event_id text not null,
  source_message_ids text[] not null default '{}',
  role text not null default 'commercial',
  decision text not null,
  proposed_reply text not null default '',
  reason text not null default '',
  risk_tags text[] not null default '{}',
  confidence numeric(5, 4) not null default 0,
  rule_ids text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  model text not null default '',
  provider text not null default '',
  model_usage jsonb null,
  total_cost_usd numeric(12, 6) null,
  created_at timestamptz not null default now(),
  constraint crm_ai_runs_decision_check check (decision in ('auto_reply', 'no_reply', 'needs_approval', 'ack', 'escalate')),
  constraint crm_ai_runs_confidence_check check (confidence between 0 and 1),
  unique (workspace_id, source_event_id)
);

create table if not exists public.crm_ai_suggestions (
  id text primary key default ('ais_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  run_id text not null references public.crm_ai_runs(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  suggestion_key text not null,
  suggestion_type text not null,
  category text not null,
  title text not null,
  description text not null default '',
  structured_data jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4) not null default 0,
  evidence text not null default '',
  status text not null default 'pending',
  applied_entity_type text null,
  applied_entity_id text null,
  reviewed_by uuid null references auth.users(id) on update cascade on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_ai_suggestions_type_check check (suggestion_type in ('fact', 'action')),
  constraint crm_ai_suggestions_status_check check (status in ('pending', 'applied', 'rejected', 'superseded')),
  constraint crm_ai_suggestions_confidence_check check (confidence between 0 and 1),
  unique (run_id, suggestion_key)
);

drop trigger if exists set_crm_ai_suggestions_updated_at on public.crm_ai_suggestions;
create trigger set_crm_ai_suggestions_updated_at
before update on public.crm_ai_suggestions
for each row execute function public.set_updated_at();

alter table public.crm_ai_runs enable row level security;
alter table public.crm_ai_suggestions enable row level security;

drop policy if exists "Admins manage crm_ai_runs" on public.crm_ai_runs;
create policy "Admins manage crm_ai_runs" on public.crm_ai_runs
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage crm_ai_suggestions" on public.crm_ai_suggestions;
create policy "Admins manage crm_ai_suggestions" on public.crm_ai_suggestions
for all using (public.is_admin()) with check (public.is_admin());

create index if not exists crm_ai_runs_contact_time_idx
  on public.crm_ai_runs(contact_id, created_at desc);
create index if not exists crm_ai_runs_workspace_time_idx
  on public.crm_ai_runs(workspace_id, created_at desc);
create index if not exists crm_ai_suggestions_review_idx
  on public.crm_ai_suggestions(workspace_id, status, created_at desc);
create index if not exists crm_ai_suggestions_contact_idx
  on public.crm_ai_suggestions(contact_id, category, created_at desc);
