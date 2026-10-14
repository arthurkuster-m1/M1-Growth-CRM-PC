-- manifest: **Recorrência: quantos meses manter à frente.** `crm_sales.recurrence_ahead` (1 a 12, padrão 1): a rotina diária mantém sempre esse número de parcelas PREVISTAS à frente numa assinatura ativa (3 = sempre 3 meses de previsão). As assinaturas existentes seguem com 1, como era.

alter table public.crm_sales
  add column if not exists recurrence_ahead smallint not null default 1;

alter table public.crm_sales drop constraint if exists crm_sales_recurrence_ahead_check;
alter table public.crm_sales add constraint crm_sales_recurrence_ahead_check
  check (recurrence_ahead between 1 and 12);

notify pgrst, 'reload schema';
