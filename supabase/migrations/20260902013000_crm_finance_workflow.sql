alter table public.crm_receivables
  add column if not exists source text not null default 'manual',
  add column if not exists source_conversation_id text null references public.crm_conversations(id) on update cascade on delete set null,
  add column if not exists settled_at timestamptz null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.crm_payment_receipts
  add column if not exists financial_account_id text null references public.crm_financial_accounts(id) on update cascade on delete set null,
  add column if not exists match_status text not null default 'unmatched',
  add column if not exists review_notes text not null default '',
  add column if not exists source_suggestion_id text null references public.crm_ai_suggestions(id) on update cascade on delete set null;

alter table public.crm_payment_receipts
  drop constraint if exists crm_payment_receipts_match_status_check;

alter table public.crm_payment_receipts
  add constraint crm_payment_receipts_match_status_check
  check (match_status in ('unmatched', 'exact', 'partial', 'overpaid', 'manual'));

create unique index if not exists crm_receivables_active_order_unique_idx
  on public.crm_receivables(order_id)
  where order_id is not null and status <> 'cancelled';

create unique index if not exists crm_payments_active_receipt_unique_idx
  on public.crm_payments(receipt_id)
  where receipt_id is not null and status <> 'reversed';

create unique index if not exists crm_payment_receipts_source_suggestion_unique_idx
  on public.crm_payment_receipts(source_suggestion_id)
  where source_suggestion_id is not null;

create unique index if not exists crm_financial_entries_payment_unique_idx
  on public.crm_financial_entries(payment_id)
  where payment_id is not null and status <> 'cancelled';

create index if not exists crm_receivables_contact_status_idx
  on public.crm_receivables(workspace_id, contact_id, status, due_date);

create index if not exists crm_payments_paid_at_idx
  on public.crm_payments(workspace_id, status, paid_at desc);

create or replace function public.crm_recalculate_receivable(target_receivable_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_amount numeric(12, 2);
  total_paid numeric(12, 2);
begin
  select amount into target_amount
  from public.crm_receivables
  where id = target_receivable_id
  for update;

  if target_amount is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into total_paid
  from public.crm_payments
  where receivable_id = target_receivable_id
    and status = 'confirmed';

  update public.crm_receivables
  set
    paid_amount = total_paid,
    status = case
      when total_paid >= target_amount then 'paid'
      when total_paid > 0 then 'partially_paid'
      when due_date is not null and due_date < current_date then 'overdue'
      else 'pending'
    end,
    settled_at = case when total_paid >= target_amount then coalesce(settled_at, now()) else null end
  where id = target_receivable_id
    and status <> 'cancelled';
end;
$$;

create or replace function public.crm_recalculate_receivable_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.receivable_id is not null then
      perform public.crm_recalculate_receivable(old.receivable_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.receivable_id is distinct from new.receivable_id and old.receivable_id is not null then
    perform public.crm_recalculate_receivable(old.receivable_id);
  end if;
  if new.receivable_id is not null then
    perform public.crm_recalculate_receivable(new.receivable_id);
  end if;
  return new;
end;
$$;

drop trigger if exists crm_payments_recalculate_receivable on public.crm_payments;
create trigger crm_payments_recalculate_receivable
after insert or update or delete on public.crm_payments
for each row execute function public.crm_recalculate_receivable_from_payment();

create or replace function public.crm_create_receivable_for_confirmed_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('confirmed', 'in_service', 'completed') and new.total_amount > 0 then
    insert into public.crm_receivables (
      workspace_id, contact_id, order_id, status, amount, paid_amount, due_date,
      payment_timing, description, source, source_conversation_id, metadata
    ) values (
      new.workspace_id, new.contact_id, new.id, 'pending', new.total_amount, 0,
      case when new.payment_timing = 'after_service' and new.completed_at is null then null else current_date end,
      new.payment_timing, coalesce(nullif(new.notes, ''), 'Serviço confirmado'),
      'order', new.source_conversation_id, jsonb_build_object('createdBy', 'order_trigger')
    )
    on conflict (order_id) where order_id is not null and status <> 'cancelled'
    do update set
      amount = greatest(excluded.amount, public.crm_receivables.paid_amount),
      payment_timing = excluded.payment_timing,
      description = excluded.description,
      source_conversation_id = excluded.source_conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists crm_orders_create_receivable on public.crm_orders;
create trigger crm_orders_create_receivable
after insert or update of status, total_amount, payment_timing, completed_at on public.crm_orders
for each row execute function public.crm_create_receivable_for_confirmed_order();

grant execute on function public.crm_recalculate_receivable(text) to service_role;
