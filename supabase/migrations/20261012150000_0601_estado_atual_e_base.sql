-- manifest: **Estado atual das campanhas e tipo "Aproveitamento de base".** `fn_demand_campaigns_estado` (investido e leads do CRM no período de cada campanha: o mês, se contínua; o período todo, se tem início e fim); canal `aproveitamento_de_base` (clientes ativos: recompra, recorrência); um funil pertence a no máximo uma campanha (índice único em `pipeline_id`).

-- ============================================================================
-- 0601 — ESTADO ATUAL + APROVEITAMENTO DE BASE + FUNIL ÚNICO POR CAMPANHA
--
-- Estado atual: "11/10 | Investido: R$ 138,52 | 62 Leads | CPL R$ 2,23" — o investido vem do dia
-- a dia da campanha; os leads, SEMPRE do CRM (contatos distintos que entraram no funil dela).
-- Período: campanha contínua (ou sem início) = o mês corrente; com início e fim = do início até
-- hoje (ou até o fim, se já passou).
-- ============================================================================

alter table public.demand_campaigns drop constraint if exists demand_campaigns_channel_check;
alter table public.demand_campaigns add constraint demand_campaigns_channel_check
  check (channel in ('trafego_pago', 'prospeccao', 'social_media', 'indicacao', 'parcerias',
                     'aproveitamento_de_base'));

-- Cada funil é de UMA campanha (criado dentro dela). Vários funis sem campanha seguem existindo
-- (legado); o que não pode é dois negócios de campanha no mesmo funil.
create unique index if not exists demand_campaigns_pipeline_uk
  on public.demand_campaigns (pipeline_id) where pipeline_id is not null;

create or replace function public.fn_demand_campaigns_estado(
  p_org uuid,
  p_tz text default 'America/Sao_Paulo'
)
returns table (campaign_id uuid, de date, ate date, spend numeric, leads integer)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with hoje as (select (now() at time zone p_tz)::date as d),
  janela as (
    select c.id,
           c.pipeline_id,
           case when c.continuous or c.start_date is null
                then date_trunc('month', h.d)::date else c.start_date end as de,
           case when c.continuous or c.end_date is null
                then h.d else least(c.end_date, h.d) end as ate
      from public.demand_campaigns c
     cross join hoje h
     where c.organization_id = p_org
  )
  select j.id,
         j.de,
         j.ate,
         coalesce((select sum(d.spend)
                     from public.demand_campaign_days d
                    where d.campaign_id = j.id and d.day between j.de and j.ate), 0),
         coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                     from public.crm_leads l
                    where l.organization_id = p_org
                      and l.pipeline_id = j.pipeline_id
                      and (l.created_at at time zone p_tz)::date between j.de and j.ate), 0)
    from janela j;
$$;

comment on function public.fn_demand_campaigns_estado(uuid, text) is
  'Investido e leads (do CRM) no período de cada campanha de demanda da organização: o mês corrente se contínua; do início até hoje/fim se tem datas. Alimenta a propriedade "Estado atual".';

revoke all on function public.fn_demand_campaigns_estado(uuid, text) from public, anon;
grant execute on function public.fn_demand_campaigns_estado(uuid, text) to authenticated;

notify pgrst, 'reload schema';
