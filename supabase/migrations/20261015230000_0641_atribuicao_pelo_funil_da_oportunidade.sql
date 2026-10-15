-- manifest: **Atribuição pelo funil da oportunidade.** O lead e o faturamento de uma campanha vêm da campanha DONA do funil em que a oportunidade está (`fn_campanha_da_oportunidade`: a campanha cujo funil é o da oportunidade; se nenhuma campanha é dona do funil, vale a campanha de origem). Assim o lead reaproveitado numa campanha de reativação fatura na reativação e não infla a campanha de tráfego antiga, que continua na origem e nas tags dele. A tag da campanha dona do funil entra junto com a do funil.

create or replace function public.fn_campanha_da_oportunidade(
  p_org uuid, p_pipeline uuid, p_origem uuid
) returns uuid
language sql stable set search_path = public as $f$
  select coalesce(
    (select c.id from public.demand_campaigns c
      where c.organization_id = p_org and c.pipeline_id is not null and c.pipeline_id = p_pipeline
      order by c.created_at, c.id limit 1),
    p_origem
  )
$f$;

-- ── Leads por dia: onde a oportunidade entrou ───────────────────────────────
create or replace function public.fn_demand_campaign_leads_by_day(
  p_org uuid, p_pipeline uuid, p_from date, p_to date,
  p_tz text default 'America/Sao_Paulo', p_campaign uuid default null
) returns table(day date, leads integer)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  select (l.created_at at time zone p_tz)::date as day,
         count(distinct coalesce(l.contact_id, l.id))::integer as leads
    from public.crm_leads l
   where l.organization_id = p_org
     and (
       (p_campaign is not null
        and public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = p_campaign)
       or (p_campaign is null and p_pipeline is not null and l.pipeline_id = p_pipeline)
     )
     and (l.created_at at time zone p_tz)::date between p_from and p_to
   group by 1
   order by 1;
$f$;

-- ── Resultados por campanha: leads e dinheiro da campanha dona do funil ─────
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
               where l.organization_id = p_org and l.status <> 'lost'
                 and public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                 and (select min(p.paid_on) from public.crm_sale_payments p
                       where p.lead_id = l.id and p.status = 'recebida') between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                and p.status = 'recebida'
                and l.status <> 'lost' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where public.fn_campanha_da_oportunidade(l.organization_id, l.pipeline_id, l.demand_campaign_id) = c.id
                and p.status = 'prevista'
                and l.status <> 'lost' and p.due_on between p_from and p_to), 0)
  from public.demand_campaigns c
  where c.organization_id = p_org;
$f$;

-- ── A tag da campanha dona do funil entra junto com a do funil ──────────────
create or replace function public.fn_lead_tag_do_funil()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_campanha text;
begin
  if new.contact_id is null then return new; end if;
  select name into v_nome from public.crm_pipelines where id = new.pipeline_id;
  if v_nome is not null then
    perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                       'Funil: ' || public.fn_inicial_maiuscula(v_nome));
  end if;
  select c.name into v_campanha
    from public.demand_campaigns c
   where c.organization_id = new.organization_id and c.pipeline_id = new.pipeline_id
   order by c.created_at, c.id limit 1;
  if v_campanha is not null then
    perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                       'Campanha: ' || public.fn_inicial_maiuscula(v_campanha));
  end if;
  return new;
end
$$;

notify pgrst, 'reload schema';
