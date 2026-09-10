-- Permite que a Bia relacione um comprovante observado à sugestão que o originou.
-- Não cria pagamentos, não dá baixa e não altera comprovantes existentes.
alter table public.crm_payment_receipts
  add column if not exists source_suggestion_id text null
    references public.crm_ai_suggestions(id) on update cascade on delete set null;

create unique index if not exists crm_payment_receipts_source_suggestion_unique_idx
  on public.crm_payment_receipts(source_suggestion_id)
  where source_suggestion_id is not null;
