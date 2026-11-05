-- manifest: **Empresas no Modo agência.** `organizations.agencia_lead_id` liga a empresa à sua oportunidade no CRM da agência (de onde saem entrada, mensalidade e próximo pagamento) e `fn_resumo_das_empresas` resume cada empresa num período (usuários, campanhas ativas, investimento líquido, leads, vendas, faturamento recebido); só o service role a executa.
alter table public.organizations
  add column if not exists agencia_lead_id uuid references public.crm_leads(id) on delete set null;

create index if not exists organizations_agencia_lead_idx
  on public.organizations (agencia_lead_id) where agencia_lead_id is not null;

comment on column public.organizations.agencia_lead_id is
  'A oportunidade (crm_leads) desta empresa no CRM da AGÊNCIA: de lá saem a data de entrada, o status da mensalidade e o próximo pagamento. Só o painel de plataforma escreve; ON DELETE SET NULL (apagar o lead não apaga a empresa).';

create or replace function public.fn_resumo_das_empresas(p_ids uuid[], p_de date, p_ate date)
returns table (
  organization_id uuid,
  usuarios_ativos integer,
  campanhas_ativas integer,
  investimento_cents bigint,
  leads integer,
  vendas integer,
  faturamento_cents bigint,
  entrada date,
  mensalidade text,
  proximo_pagamento date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    (select count(*) from public.user_organizations uo
      where uo.organization_id = a.id and uo.revoked_at is null)::integer,
    (select count(*) from public.demand_campaigns c
      where c.organization_id = a.id and c.status = 'ativa')::integer,
    -- Investimento LÍQUIDO (o bruto sem o imposto da campanha), em centavos, no período.
    (select coalesce(round(sum(d.spend / (1 + c.tax_pct / 100)) * 100), 0)
       from public.demand_campaign_days d
       join public.demand_campaigns c on c.id = d.campaign_id
      where d.organization_id = a.id and d.day between p_de and p_ate)::bigint,
    (select count(*) from public.crm_leads l
      where l.organization_id = a.id
        and (l.created_at at time zone a.timezone)::date between p_de and p_ate)::integer,
    (select count(*) from public.crm_leads l
      where l.organization_id = a.id and l.status = 'won'
        and (l.closed_at at time zone a.timezone)::date between p_de and p_ate)::integer,
    -- Faturamento = o que de fato foi RECEBIDO (parcelas pagas) no período.
    (select coalesce(sum(p.amount_cents), 0) from public.crm_sale_payments p
      where p.organization_id = a.id and p.status = 'recebida'
        and p.paid_on between p_de and p_ate)::bigint,
    -- Entrada: quando o lead da agência virou cliente (ganho) ou, sem isso, a criação da empresa.
    coalesce(
      (select ((case when l.status = 'won' then l.closed_at else l.created_at end)
                at time zone a.timezone)::date
         from public.crm_leads l where l.id = a.agencia_lead_id),
      (a.created_at at time zone a.timezone)::date
    ),
    -- Mensalidade, a partir das parcelas do lead da agência: vencida e não paga = pendente.
    (select case
              when count(*) = 0 then null
              when bool_or(p.status = 'prevista' and p.due_on <= current_date) then 'pendente'
              when bool_or(p.status = 'recebida') then 'pago'
              else 'pendente'
            end
       from public.crm_sale_payments p
      where p.lead_id = a.agencia_lead_id and p.status <> 'cancelada'),
    (select min(p.due_on) from public.crm_sale_payments p
      where p.lead_id = a.agencia_lead_id and p.status = 'prevista')
  from public.organizations a
  where p_ids is null or cardinality(p_ids) = 0 or a.id = any(p_ids)
$$;

revoke execute on function public.fn_resumo_das_empresas(uuid[], date, date) from public, anon, authenticated;
grant execute on function public.fn_resumo_das_empresas(uuid[], date, date) to service_role;
