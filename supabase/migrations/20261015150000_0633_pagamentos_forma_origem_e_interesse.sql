-- manifest: **Passo 4 do modelo CRM: pagamentos.** `crm_sale_payments` ganha `forma` (PIX, cartão, boleto… por parcela), `origem_do_pagamento` (manual | integracao), `id_externo` (id da transação no gateway/Hotmart, único por empresa, evita lançamento duplicado) e `confirmed_by` (quem confirmou); parcela cancelada reabre o valor como interesse no resumo do contato (`interest_cents`) até ser excluída; o resumo do contato passa a ser recalculado também quando uma parcela é excluída; `crm_leads.com_pagamento` (a oportunidade já recebeu algum pagamento) mantido por trigger, para o selo "Aguardando pagamento" nos cards em Comprou.

-- ── 1. Colunas ──────────────────────────────────────────────────────────────
alter table public.crm_sale_payments
  add column if not exists forma text,
  add column if not exists origem_do_pagamento text not null default 'manual',
  add column if not exists id_externo text,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null;

alter table public.crm_sale_payments drop constraint if exists crm_sale_payments_origem_check;
alter table public.crm_sale_payments add constraint crm_sale_payments_origem_check
  check (origem_do_pagamento in ('manual', 'integracao'));

create unique index if not exists crm_sale_payments_id_externo_uniq
  on public.crm_sale_payments (organization_id, id_externo)
  where id_externo is not null;

comment on column public.crm_sale_payments.forma is
  'Como esta parcela foi/será paga (pix, cartao_credito, cartao_debito, boleto, transferencia, dinheiro, recorrencia, outro).';
comment on column public.crm_sale_payments.id_externo is
  'Id da transação no gateway ou na Hotmart; único por empresa (evita lançar a mesma cobrança duas vezes).';

-- A forma das parcelas que já existem: a da venda.
update public.crm_sale_payments p
   set forma = nullif(s.payment_method, '')
  from public.crm_sales s
 where s.id = p.sale_id and p.forma is null;

-- A parcela nova nasce com a forma de pagamento da venda.
create or replace function public.fn_crm_payment_forma_padrao()
returns trigger language plpgsql as $f$
begin
  if new.forma is null then
    select nullif(payment_method, '') into new.forma from public.crm_sales where id = new.sale_id;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_payment_forma_padrao on public.crm_sale_payments;
create trigger trg_crm_payment_forma_padrao
  before insert on public.crm_sale_payments
  for each row execute function public.fn_crm_payment_forma_padrao();

-- ── 2. Parcela cancelada reabre o valor como interesse ──────────────────────
create or replace function public.fn_crm_sales_refresh_contact(p_org uuid, p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ltv bigint; v_prev bigint; v_int bigint; v_n integer; v_first date; v_last date;
begin
  with vendas as (
    select s.id, s.status, s.amount_cents, s.paid_on,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida'), 0) as pago,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista'), 0) as previsto,
           coalesce(sum(p.amount_cents) filter (where p.status = 'cancelada'), 0) as cancelado,
           count(p.id) filter (where p.status <> 'cancelada') as parcelas,
           count(p.id) filter (where p.status = 'recebida') as recebidas,
           min(p.paid_on) filter (where p.status = 'recebida') as primeira_paga,
           max(p.paid_on) filter (where p.status = 'recebida') as ultima_paga
      from public.crm_sales s
      left join public.crm_sale_payments p on p.sale_id = s.id
     where s.organization_id = p_org and s.contact_id = p_contact
     group by s.id
  ),
  pagas as (
    select v.*,
           case when parcelas = 0 and status = 'concluida' then amount_cents else pago end as valor_pago,
           case when parcelas = 0 and status = 'concluida' then paid_on else primeira_paga end as data_primeira,
           case when parcelas = 0 and status = 'concluida' then paid_on else ultima_paga end as data_ultima,
           (recebidas > 0 or (parcelas = 0 and status = 'concluida')) as foi_paga
      from vendas v
  )
  select
    coalesce(sum(valor_pago) filter (where status in ('comprometida', 'concluida')), 0),
    coalesce(sum(case when parcelas = 0 and status = 'comprometida' then amount_cents else previsto end)
             filter (where status in ('comprometida', 'concluida')), 0),
    -- Interesse: vendas em interesse + o valor das parcelas canceladas (volta a ser "possível venda").
    coalesce(sum(amount_cents) filter (where status = 'interesse'), 0)
      + coalesce(sum(cancelado) filter (where status in ('comprometida', 'concluida')), 0),
    count(*) filter (where foi_paga and status in ('comprometida', 'concluida'))::integer,
    min(data_primeira) filter (where foi_paga and status in ('comprometida', 'concluida')),
    max(data_ultima) filter (where foi_paga and status in ('comprometida', 'concluida'))
    into v_ltv, v_prev, v_int, v_n, v_first, v_last
    from pagas;

  update public.contacts
     set ltv_cents = v_ltv,
         ltv_forecast_cents = v_ltv + v_prev,
         interest_cents = v_int,
         sales_count = v_n,
         last_purchase_on = v_last,
         first_purchase_on = v_first
   where id = p_contact and organization_id = p_org;
end
$$;

-- ── 3. Excluir parcela também atualiza o resumo do contato ──────────────────
create or replace function public.fn_crm_payment_deleted_refresh()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_contact uuid;
begin
  select contact_id into v_contact from public.crm_sales where id = old.sale_id;
  if v_contact is not null then
    perform public.fn_crm_sales_refresh_contact(old.organization_id, v_contact);
  end if;
  return old;
end
$f$;
revoke execute on function public.fn_crm_payment_deleted_refresh() from public, anon, authenticated;

drop trigger if exists trg_crm_payment_deleted_refresh on public.crm_sale_payments;
create trigger trg_crm_payment_deleted_refresh
  after delete on public.crm_sale_payments
  for each row execute function public.fn_crm_payment_deleted_refresh();

-- Recalcula o resumo de quem tem parcela cancelada.
do $$
declare r record;
begin
  for r in
    select distinct s.organization_id, s.contact_id
      from public.crm_sale_payments p join public.crm_sales s on s.id = p.sale_id
     where p.status = 'cancelada' and s.contact_id is not null
  loop
    perform public.fn_crm_sales_refresh_contact(r.organization_id, r.contact_id);
  end loop;
end
$$;

-- ── 4. A oportunidade já recebeu algum pagamento? (selo "Aguardando pagamento") ──
alter table public.crm_leads
  add column if not exists com_pagamento boolean not null default false;

create or replace function public.fn_lead_atualiza_com_pagamento(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $f$
begin
  if p_lead is null then return; end if;
  update public.crm_leads l
     set com_pagamento = exists (
           select 1 from public.crm_sales s
            where s.lead_id = l.id
              and (
                exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id and p.status = 'recebida')
                or (s.status = 'concluida' and s.paid_on is not null
                    and not exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id and p.status <> 'cancelada'))
              )
         )
   where l.id = p_lead
     and l.com_pagamento is distinct from exists (
           select 1 from public.crm_sales s
            where s.lead_id = l.id
              and (
                exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id and p.status = 'recebida')
                or (s.status = 'concluida' and s.paid_on is not null
                    and not exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id and p.status <> 'cancelada'))
              )
         );
end
$f$;
revoke execute on function public.fn_lead_atualiza_com_pagamento(uuid) from public, anon, authenticated;

create or replace function public.fn_com_pagamento_apos_parcela()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_sale uuid := case when tg_op = 'DELETE' then old.sale_id else new.sale_id end;
  v_lead uuid;
begin
  select lead_id into v_lead from public.crm_sales where id = v_sale;
  perform public.fn_lead_atualiza_com_pagamento(v_lead);
  return null;
end
$f$;
revoke execute on function public.fn_com_pagamento_apos_parcela() from public, anon, authenticated;

drop trigger if exists trg_com_pagamento_apos_parcela on public.crm_sale_payments;
create trigger trg_com_pagamento_apos_parcela
  after insert or delete or update of status on public.crm_sale_payments
  for each row execute function public.fn_com_pagamento_apos_parcela();

create or replace function public.fn_com_pagamento_apos_venda()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  perform public.fn_lead_atualiza_com_pagamento(new.lead_id);
  return null;
end
$f$;
revoke execute on function public.fn_com_pagamento_apos_venda() from public, anon, authenticated;

drop trigger if exists trg_com_pagamento_apos_venda on public.crm_sales;
create trigger trg_com_pagamento_apos_venda
  after insert or update of status, paid_on, lead_id on public.crm_sales
  for each row execute function public.fn_com_pagamento_apos_venda();

do $$
declare r record;
begin
  for r in select distinct lead_id from public.crm_sales where lead_id is not null loop
    perform public.fn_lead_atualiza_com_pagamento(r.lead_id);
  end loop;
end
$$;

notify pgrst, 'reload schema';
