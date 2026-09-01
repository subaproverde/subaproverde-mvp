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

create table if not exists public.crm_workspaces (
  id text primary key default ('wsp_' || replace(gen_random_uuid()::text, '-', '')),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_workspace_members (
  id text primary key default ('wmb_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  role text not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_workspace_members_role_check check (role in ('owner', 'admin', 'manager', 'operator', 'viewer')),
  unique (workspace_id, user_id)
);

create table if not exists public.crm_contacts (
  id text primary key default ('ctc_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  admin_client_id text null references public.admin_clients(id) on update cascade on delete set null,
  name text not null default '',
  company_name text not null default '',
  document text not null default '',
  phone text not null default '',
  email text not null default '',
  lifecycle_stage text not null default 'lead',
  owner_user_id uuid null references auth.users(id) on update cascade on delete set null,
  source text not null default 'whatsapp',
  tags text[] not null default '{}',
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  last_interaction_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contacts_lifecycle_check check (lifecycle_stage in ('lead', 'qualified', 'customer', 'inactive'))
);

create table if not exists public.crm_contact_identities (
  id text primary key default ('cid_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  channel text not null,
  provider text not null default '',
  external_id text not null,
  normalized_value text not null default '',
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contact_identities_channel_check check (channel in ('whatsapp', 'phone', 'email', 'mercado_livre', 'other')),
  unique (workspace_id, channel, provider, external_id)
);

create table if not exists public.crm_leads (
  id text primary key default ('led_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  title text not null default '',
  stage text not null default 'new',
  status text not null default 'open',
  source text not null default 'whatsapp',
  score integer not null default 0,
  estimated_value numeric(12, 2) not null default 0,
  summary text not null default '',
  loss_reason text not null default '',
  last_contact_at timestamptz null,
  next_follow_up_at timestamptz null,
  won_at timestamptz null,
  lost_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_stage_check check (stage in ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  constraint crm_leads_status_check check (status in ('open', 'won', 'lost', 'archived')),
  constraint crm_leads_score_check check (score between 0 and 100)
);

create table if not exists public.crm_conversations (
  id text primary key default ('cnv_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  lead_id text null references public.crm_leads(id) on update cascade on delete set null,
  channel text not null default 'whatsapp',
  provider text not null default 'evolution',
  external_thread_id text not null,
  status text not null default 'open',
  assigned_to uuid null references auth.users(id) on update cascade on delete set null,
  unread_count integer not null default 0,
  needs_human boolean not null default false,
  assistant_mode text not null default 'autonomous',
  last_message_at timestamptz null,
  last_inbound_at timestamptz null,
  last_outbound_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_conversations_status_check check (status in ('open', 'waiting_customer', 'waiting_team', 'paused', 'closed')),
  constraint crm_conversations_mode_check check (assistant_mode in ('autonomous', 'approval', 'human', 'paused')),
  unique (workspace_id, channel, provider, external_thread_id)
);

create table if not exists public.crm_messages (
  id text primary key default ('msg_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  conversation_id text not null references public.crm_conversations(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  external_message_id text not null,
  direction text not null,
  sender_type text not null,
  message_type text not null default 'text',
  body text not null default '',
  transcription text not null default '',
  media_url text not null default '',
  occurred_at timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_messages_direction_check check (direction in ('inbound', 'outbound')),
  constraint crm_messages_sender_type_check check (sender_type in ('contact', 'assistant', 'operator', 'system')),
  constraint crm_messages_type_check check (message_type in ('text', 'audio', 'image', 'document', 'video', 'location', 'other')),
  unique (workspace_id, external_message_id)
);

create table if not exists public.crm_activities (
  id text primary key default ('act_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text null references public.crm_contacts(id) on update cascade on delete cascade,
  lead_id text null references public.crm_leads(id) on update cascade on delete cascade,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete cascade,
  activity_type text not null,
  title text not null,
  description text not null default '',
  actor_type text not null default 'system',
  actor_id text not null default '',
  source_event_id text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, source_event_id)
);

create table if not exists public.crm_tasks (
  id text primary key default ('tsk_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text null references public.crm_contacts(id) on update cascade on delete cascade,
  lead_id text null references public.crm_leads(id) on update cascade on delete cascade,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete cascade,
  title text not null,
  description text not null default '',
  task_type text not null default 'follow_up',
  status text not null default 'pending',
  priority text not null default 'medium',
  due_at timestamptz null,
  assigned_to uuid null references auth.users(id) on update cascade on delete set null,
  automation_key text null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_tasks_status_check check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  constraint crm_tasks_priority_check check (priority in ('low', 'medium', 'high', 'urgent'))
);

create table if not exists public.crm_extracted_facts (
  id text primary key default ('fac_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete cascade,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  message_id text null references public.crm_messages(id) on update cascade on delete set null,
  fact_type text not null,
  fact_key text not null,
  fact_value jsonb not null,
  confidence numeric(5, 4) not null default 0,
  status text not null default 'observed',
  evidence text not null default '',
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_extracted_facts_confidence_check check (confidence between 0 and 1),
  constraint crm_extracted_facts_status_check check (status in ('observed', 'confirmed', 'rejected', 'superseded'))
);

create table if not exists public.crm_quotes (
  id text primary key default ('quo_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete restrict,
  lead_id text null references public.crm_leads(id) on update cascade on delete set null,
  status text not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  valid_until date null,
  source_conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  notes text not null default '',
  sent_at timestamptz null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_quotes_status_check check (status in ('draft', 'review', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'))
);

create table if not exists public.crm_quote_items (
  id text primary key default ('qit_' || replace(gen_random_uuid()::text, '-', '')),
  quote_id text not null references public.crm_quotes(id) on update cascade on delete cascade,
  service_type text not null,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) generated always as (quantity * unit_price) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_quote_items_quantity_check check (quantity > 0)
);

create table if not exists public.crm_orders (
  id text primary key default ('ord_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete restrict,
  lead_id text null references public.crm_leads(id) on update cascade on delete set null,
  quote_id text null references public.crm_quotes(id) on update cascade on delete set null,
  status text not null default 'draft',
  payment_timing text not null default 'after_service',
  total_amount numeric(12, 2) not null default 0,
  source_conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  confirmed_at timestamptz null,
  completed_at timestamptz null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_orders_status_check check (status in ('draft', 'review', 'confirmed', 'in_service', 'completed', 'cancelled')),
  constraint crm_orders_payment_timing_check check (payment_timing in ('after_service', 'before_service'))
);

create table if not exists public.crm_order_items (
  id text primary key default ('oit_' || replace(gen_random_uuid()::text, '-', '')),
  order_id text not null references public.crm_orders(id) on update cascade on delete cascade,
  service_type text not null,
  description text not null,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) generated always as (quantity * unit_price) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_order_items_quantity_check check (quantity > 0)
);

create table if not exists public.crm_service_jobs (
  id text primary key default ('job_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  order_id text not null references public.crm_orders(id) on update cascade on delete cascade,
  order_item_id text null references public.crm_order_items(id) on update cascade on delete set null,
  admin_removal_id text null references public.admin_removals(id) on update cascade on delete set null,
  service_type text not null,
  status text not null default 'pending',
  requested_quantity numeric(12, 2) not null default 1,
  completed_quantity numeric(12, 2) not null default 0,
  started_at timestamptz null,
  completed_at timestamptz null,
  evidence jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_service_jobs_status_check check (status in ('pending', 'scheduled', 'in_progress', 'waiting_customer', 'completed', 'failed', 'cancelled'))
);

create table if not exists public.crm_financial_accounts (
  id text primary key default ('facct_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  provider text not null,
  name text not null,
  account_type text not null default 'bank',
  active boolean not null default true,
  reconciliation_mode text not null default 'manual',
  integration_status text not null default 'not_configured',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_financial_accounts_provider_check check (provider in ('banco_inter', 'nubank', 'other')),
  constraint crm_financial_accounts_reconciliation_check check (reconciliation_mode in ('manual', 'statement_import', 'api')),
  constraint crm_financial_accounts_integration_check check (integration_status in ('not_configured', 'pending', 'connected', 'error')),
  unique (workspace_id, provider, name)
);

create table if not exists public.crm_receivables (
  id text primary key default ('rec_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete restrict,
  order_id text null references public.crm_orders(id) on update cascade on delete set null,
  status text not null default 'pending',
  amount numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null default 0,
  open_amount numeric(12, 2) generated always as (greatest(amount - paid_amount, 0)) stored,
  due_date date null,
  payment_timing text not null default 'after_service',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_receivables_status_check check (status in ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  constraint crm_receivables_payment_timing_check check (payment_timing in ('after_service', 'before_service')),
  constraint crm_receivables_amount_check check (amount >= 0 and paid_amount >= 0)
);

create table if not exists public.crm_payment_receipts (
  id text primary key default ('rcp_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete restrict,
  receivable_id text null references public.crm_receivables(id) on update cascade on delete set null,
  conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  message_id text null references public.crm_messages(id) on update cascade on delete set null,
  status text not null default 'received',
  claimed_amount numeric(12, 2) null,
  extracted_amount numeric(12, 2) null,
  payer_name text not null default '',
  paid_at timestamptz null,
  bank_reference text not null default '',
  file_url text not null default '',
  extraction jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4) not null default 0,
  reviewed_by uuid null references auth.users(id) on update cascade on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_payment_receipts_status_check check (status in ('received', 'review', 'approved', 'rejected')),
  constraint crm_payment_receipts_confidence_check check (confidence between 0 and 1)
);

create table if not exists public.crm_payments (
  id text primary key default ('pay_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text not null references public.crm_contacts(id) on update cascade on delete restrict,
  receivable_id text null references public.crm_receivables(id) on update cascade on delete set null,
  receipt_id text null references public.crm_payment_receipts(id) on update cascade on delete set null,
  financial_account_id text null references public.crm_financial_accounts(id) on update cascade on delete set null,
  status text not null default 'pending',
  amount numeric(12, 2) not null,
  method text not null default 'pix',
  paid_at timestamptz null,
  confirmed_at timestamptz null,
  external_reference text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_payments_status_check check (status in ('pending', 'confirmed', 'reversed')),
  constraint crm_payments_amount_check check (amount >= 0)
);

create table if not exists public.crm_financial_entries (
  id text primary key default ('fen_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  contact_id text null references public.crm_contacts(id) on update cascade on delete set null,
  order_id text null references public.crm_orders(id) on update cascade on delete set null,
  payment_id text null references public.crm_payments(id) on update cascade on delete set null,
  entry_type text not null,
  category text not null default '',
  status text not null default 'planned',
  amount numeric(12, 2) not null,
  competence_date date not null default current_date,
  settled_at timestamptz null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_financial_entries_type_check check (entry_type in ('income', 'expense')),
  constraint crm_financial_entries_status_check check (status in ('planned', 'settled', 'cancelled')),
  constraint crm_financial_entries_amount_check check (amount >= 0)
);

create table if not exists public.crm_fiscal_settings (
  id text primary key default ('fis_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null unique references public.crm_workspaces(id) on update cascade on delete cascade,
  enabled boolean not null default false,
  provider text null,
  environment text not null default 'sandbox',
  municipal_registration text not null default '',
  service_code text not null default '',
  default_description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_fiscal_settings_environment_check check (environment in ('sandbox', 'production'))
);

create table if not exists public.crm_audit_events (
  id text primary key default ('aud_' || replace(gen_random_uuid()::text, '-', '')),
  workspace_id text not null references public.crm_workspaces(id) on update cascade on delete cascade,
  event_key text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_type text not null default 'system',
  actor_id text not null default '',
  before_data jsonb null,
  after_data jsonb null,
  reasoning text not null default '',
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, event_key)
);

insert into public.crm_workspaces (id, name, slug)
values ('wsp_suba_pro_verde', 'Suba Pro Verde', 'suba-pro-verde')
on conflict (slug) do nothing;

insert into public.crm_financial_accounts (
  id, workspace_id, provider, name, reconciliation_mode, integration_status
)
values
  ('facct_suba_inter', 'wsp_suba_pro_verde', 'banco_inter', 'Banco Inter', 'manual', 'not_configured'),
  ('facct_suba_nubank', 'wsp_suba_pro_verde', 'nubank', 'Nubank', 'manual', 'not_configured')
on conflict (workspace_id, provider, name) do nothing;

insert into public.crm_fiscal_settings (
  id, workspace_id, enabled, provider, environment, default_description
)
values (
  'fis_suba_pro_verde',
  'wsp_suba_pro_verde',
  false,
  null,
  'sandbox',
  'Prestacao de servicos Suba Pro Verde'
)
on conflict (workspace_id) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_workspaces', 'crm_workspace_members', 'crm_contacts', 'crm_contact_identities',
    'crm_leads', 'crm_conversations', 'crm_tasks', 'crm_extracted_facts', 'crm_quotes',
    'crm_orders', 'crm_service_jobs', 'crm_financial_accounts', 'crm_receivables',
    'crm_payment_receipts', 'crm_payments', 'crm_financial_entries', 'crm_fiscal_settings'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'crm_workspaces', 'crm_workspace_members', 'crm_contacts', 'crm_contact_identities',
    'crm_leads', 'crm_conversations', 'crm_messages', 'crm_activities', 'crm_tasks',
    'crm_extracted_facts', 'crm_quotes', 'crm_quote_items', 'crm_orders', 'crm_order_items',
    'crm_service_jobs', 'crm_financial_accounts', 'crm_receivables', 'crm_payment_receipts',
    'crm_payments', 'crm_financial_entries', 'crm_fiscal_settings', 'crm_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Admins manage %s" on public.%I', table_name, table_name);
    execute format(
      'create policy "Admins manage %s" on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create index if not exists crm_contacts_workspace_phone_idx on public.crm_contacts(workspace_id, phone);
create index if not exists crm_contacts_last_interaction_idx on public.crm_contacts(workspace_id, last_interaction_at desc);
create index if not exists crm_leads_stage_idx on public.crm_leads(workspace_id, stage, status);
create index if not exists crm_leads_follow_up_idx on public.crm_leads(workspace_id, next_follow_up_at) where status = 'open';
create index if not exists crm_conversations_attention_idx on public.crm_conversations(workspace_id, status, needs_human, last_message_at desc);
create index if not exists crm_messages_conversation_time_idx on public.crm_messages(conversation_id, occurred_at desc);
create index if not exists crm_activities_time_idx on public.crm_activities(workspace_id, occurred_at desc);
create index if not exists crm_tasks_due_idx on public.crm_tasks(workspace_id, status, due_at);
create index if not exists crm_facts_contact_idx on public.crm_extracted_facts(contact_id, fact_type, observed_at desc);
create index if not exists crm_orders_status_idx on public.crm_orders(workspace_id, status, created_at desc);
create index if not exists crm_jobs_status_idx on public.crm_service_jobs(workspace_id, status, created_at desc);
create index if not exists crm_receivables_status_idx on public.crm_receivables(workspace_id, status, due_date);
create index if not exists crm_receipts_status_idx on public.crm_payment_receipts(workspace_id, status, created_at desc);
create index if not exists crm_audit_entity_idx on public.crm_audit_events(workspace_id, entity_type, entity_id, created_at desc);
