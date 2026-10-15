-- manifest: **O dinheiro que já entrou não some com o cancelamento.** Venda cancelada (oportunidade perdida) ou assinatura encerrada continua contando no faturamento, nas vendas e no LTV pelo que JÁ foi recebido (um sinal não é devolvido); só o que estava previsto deixa de valer. Perder uma oportunidade cancela as parcelas previstas dela (`fn_oportunidade_perdida_cancela_previstas`). Relatórios por produto, por campanha e do CRM passam a somar o recebido também das oportunidades perdidas.

-- ── 1. Perder a oportunidade cancela o que estava previsto ──────────────────
create or replace function public.fn_oportunidade_perdida_cancela_previstas()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.status = 'lost' and old.status is distinct from 'lost' then
    update public.crm_sale_payments
       set status = 'cancelada'
     where lead_id = new.id and status = 'prevista';
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_oportunidade_perdida_cancela_previstas() from public, anon, authenticated;

drop trigger if exists trg_oportunidade_perdida_cancela_previstas on public.crm_leads;
create trigger trg_oportunidade_perdida_cancela_previstas
  after update of stage_id, status on public.crm_leads
  for each row execute function public.fn_oportunidade_perdida_cancela_previstas();

-- ── 2. Vendas por produto: o recebido conta mesmo na oportunidade perdida ───
create or replace function public.fn_vendas_por_produto(p_org uuid, p_from date, p_to date)
returns table(product_id uuid, nome text, vendas integer, interesse_cents bigint, recebido_cents bigint, a_receber_cents bigint)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  with itens as (
    select i.product_id, i.product_name, i.amount_cents as item_cents,
           l.id as lead_id, l.status, coalesce(l.value_cents, 0) as valor_cents,
           coalesce(l.closed_at::date, l.paid_on) as fechada_em
      from public.crm_sale_items i
      join public.crm_leads l on l.id = i.lead_id
     where i.organization_id = p_org
  ),
  parcelas as (
    select p.lead_id,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida' and p.paid_on between p_from and p_to), 0) as recebido,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista' and p.due_on between p_from and p_to), 0) as previsto,
           bool_or(p.status = 'recebida') as paga
      from public.crm_sale_payments p
     where p.organization_id = p_org
     group by p.lead_id
  )
  select it.product_id,
         max(it.product_name) as nome,
         count(distinct it.lead_id) filter (
           where coalesce(pa.paga, false) and it.fechada_em between p_from and p_to
         )::integer as vendas,
         coalesce(sum(it.item_cents) filter (
           where it.status <> 'lost' and not coalesce(pa.paga, false) and pa.lead_id is null), 0)::bigint as interesse_cents,
         coalesce(sum(case when it.valor_cents > 0
                           then pa.recebido * it.item_cents / it.valor_cents else 0 end), 0)::bigint as recebido_cents,
         coalesce(sum(case when it.valor_cents > 0 and it.status <> 'lost'
                           then pa.previsto * it.item_cents / it.valor_cents else 0 end), 0)::bigint as a_receber_cents
    from itens it
    left join parcelas pa on pa.lead_id = it.lead_id
   group by it.product_id;
$f$;

-- ── 3. Campanhas: o faturamento e as vendas incluem o recebido de perdidas ──
create or replace function public.fn_demand_campaigns_resultados(
  p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo'
) returns table(campaign_id uuid, investido numeric, leads integer, vendas integer, recebido bigint, a_receber bigint)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  select c.id,
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.campaign_id = c.id and d.day between p_from and p_to), 0),
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
    coalesce((select count(*)::integer from public.crm_leads l
               where l.organization_id = p_org
                 and public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                 and (select min(p.paid_on) from public.crm_sale_payments p
                       where p.lead_id = l.id and p.status = 'recebida') between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                and p.status = 'recebida' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                and p.status = 'prevista'
                and l.status <> 'lost' and p.due_on between p_from and p_to), 0)
  from public.demand_campaigns c
  where c.organization_id = p_org;
$f$;

create or replace function public.fn_metricas_do_crm(p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table(leads integer, vendas integer, recebido bigint, a_receber bigint, investido numeric)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  select
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
    coalesce((select count(*)::integer from public.crm_leads l
               where l.organization_id = p_org
                 and (select min(p.paid_on) from public.crm_sale_payments p
                       where p.lead_id = l.id and p.status = 'recebida') between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
              where p.organization_id = p_org and p.status = 'recebida'
                and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where p.organization_id = p_org and p.status = 'prevista'
                and l.status <> 'lost' and p.due_on between p_from and p_to), 0),
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.organization_id = p_org and d.day between p_from and p_to), 0);
$f$;

notify pgrst, 'reload schema';
