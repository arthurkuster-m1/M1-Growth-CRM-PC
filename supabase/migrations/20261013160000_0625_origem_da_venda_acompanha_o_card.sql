-- manifest: **A origem da venda nunca fica vazia quando o card tem origem.** Campanha, anúncio e landing page da VENDA (`crm_sales.demand_*`, de onde saem vendas e faturamento por criativo e por LP) eram copiados só na criação da venda; quem ganhava origem depois (lead que entra por anúncio, origem corrigida) ficava com a venda sem origem e sumia da análise. Agora (1) as vendas existentes sem origem recebem a do card e (2) toda vez que o card ganha campanha, anúncio ou página, as vendas dele que ainda estão vazias recebem o mesmo — só preenche o que está vazio, então uma origem própria da venda (diferente do lead) nunca é sobrescrita.

create or replace function public.fn_card_origem_para_vendas()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  update public.crm_sales s
     set demand_campaign_id = coalesce(s.demand_campaign_id, new.demand_campaign_id),
         demand_creative_id = case
           when s.demand_campaign_id is null or s.demand_campaign_id = new.demand_campaign_id
             then coalesce(s.demand_creative_id, new.demand_creative_id) else s.demand_creative_id end,
         demand_landing_page_id = case
           when s.demand_campaign_id is null or s.demand_campaign_id = new.demand_campaign_id
             then coalesce(s.demand_landing_page_id, new.demand_landing_page_id) else s.demand_landing_page_id end
   where s.lead_id = new.id
     and s.organization_id = new.organization_id
     and (s.demand_campaign_id is null
          or (s.demand_campaign_id = new.demand_campaign_id
              and (s.demand_creative_id is null or s.demand_landing_page_id is null)));
  return new;
end
$f$;
revoke execute on function public.fn_card_origem_para_vendas() from public, anon, authenticated;

drop trigger if exists trg_card_origem_para_vendas on public.crm_leads;
create trigger trg_card_origem_para_vendas
  after update of demand_campaign_id, demand_creative_id, demand_landing_page_id on public.crm_leads
  for each row execute function public.fn_card_origem_para_vendas();

-- Vendas que já existem.
update public.crm_sales s
   set demand_campaign_id = coalesce(s.demand_campaign_id, l.demand_campaign_id),
       demand_creative_id = case
         when s.demand_campaign_id is null or s.demand_campaign_id = l.demand_campaign_id
           then coalesce(s.demand_creative_id, l.demand_creative_id) else s.demand_creative_id end,
       demand_landing_page_id = case
         when s.demand_campaign_id is null or s.demand_campaign_id = l.demand_campaign_id
           then coalesce(s.demand_landing_page_id, l.demand_landing_page_id) else s.demand_landing_page_id end
  from public.crm_leads l
 where l.id = s.lead_id
   and l.organization_id = s.organization_id
   and (s.demand_campaign_id is null
        or (s.demand_campaign_id = l.demand_campaign_id
            and (s.demand_creative_id is null or s.demand_landing_page_id is null)));
