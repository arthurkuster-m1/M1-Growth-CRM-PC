-- manifest: **Recorrência e cobrança.** `crm_sales.recurrence_active` (assinatura em andamento: o sistema gera a parcela do próximo mês sozinho, SEM dar como paga) e `crm_sale_payments` ganha `confirmed_at`, `reminded_before_on` e `reminded_after_on` (a cobrança pede confirmação um dia antes/no dia e um dia depois do vencimento).

alter table public.crm_sales
  add column if not exists recurrence_active boolean not null default false;

alter table public.crm_sale_payments
  add column if not exists confirmed_at timestamptz,
  add column if not exists reminded_before_on date,
  add column if not exists reminded_after_on date;

-- Venda marcada como recorrente e fechada: a recorrência nasce ativa.
create or replace function public.fn_crm_sales_recurrence_default()
returns trigger language plpgsql set search_path = public as $f$
begin
  if new.is_recurring
     and new.status in ('comprometida', 'concluida')
     and (tg_op = 'INSERT' or old.is_recurring is distinct from true) then
    new.recurrence_active := true;
  end if;
  if new.status = 'cancelada' then
    new.recurrence_active := false;
  end if;
  return new;
end
$f$;
drop trigger if exists trg_crm_sales_recurrence_default on public.crm_sales;
create trigger trg_crm_sales_recurrence_default
  before insert or update on public.crm_sales
  for each row execute function public.fn_crm_sales_recurrence_default();

create index if not exists crm_sales_recurring_idx
  on public.crm_sales (organization_id) where recurrence_active;

notify pgrst, 'reload schema';
