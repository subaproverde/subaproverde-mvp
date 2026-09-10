-- Permite que a Bia relacione um comprovante observado à sugestão que o originou.
-- Não cria pagamentos, não dá baixa e não altera comprovantes existentes.
alter table public.crm_payment_receipts
  add column if not exists source_suggestion_id text null
    references public.crm_ai_suggestions(id) on update cascade on delete set null;

alter table public.crm_payment_receipts
  add column if not exists match_status text not null default 'unmatched',
  add column if not exists review_notes text not null default '';

alter table public.crm_payment_receipts
  drop constraint if exists crm_payment_receipts_match_status_check;

alter table public.crm_payment_receipts
  add constraint crm_payment_receipts_match_status_check
  check (match_status in ('unmatched', 'exact', 'partial', 'overpaid', 'manual'));

create unique index if not exists crm_payment_receipts_source_suggestion_unique_idx
  on public.crm_payment_receipts(source_suggestion_id)
  where source_suggestion_id is not null;
