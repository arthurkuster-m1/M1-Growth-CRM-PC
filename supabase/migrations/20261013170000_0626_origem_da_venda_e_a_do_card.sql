-- manifest: **A campanha, o anúncio e a página de uma venda são os do card dela.** A origem da venda (`crm_sales.demand_*`, de onde saem vendas e faturamento por campanha, criativo e LP) era herdada do "último cadastro do cliente" no momento da criação e ficava para trás quando a venda passava a pertencer a outro card/funil — uma venda de outro funil continuava somando na campanha antiga. Agora (1) as vendas existentes passam a refletir a origem do card a que pertencem e (2) a origem da venda acompanha o card sempre que o card muda ou que a venda troca de card (sobrescreve; a 0625 só preenchia vazios).

create or replace function public.fn_card_origem_para_vendas()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  update public.crm_sales s
     set demand_campaign_id = new.demand_campaign_id,
         demand_creative_id = new.demand_creative_id,
         demand_landing_page_id = new.demand_landing_page_id
   where s.lead_id = new.id
     and s.organization_id = new.organization_id
     and (s.demand_campaign_id is distinct from new.demand_campaign_id
          or s.demand_creative_id is distinct from new.demand_creative_id
          or s.demand_landing_page_id is distinct from new.demand_landing_page_id);
  return new;
end
$f$;
revoke execute on function public.fn_card_origem_para_vendas() from public, anon, authenticated;

-- A venda que entra num card (ou muda de card) assume a origem dele.
create or replace function public.fn_venda_origem_do_card()
returns trigger language plpgsql security definer set search_path = public as $f$
declare v record;
begin
  if new.lead_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.lead_id is not distinct from new.lead_id then return new; end if;
  select l.demand_campaign_id, l.demand_creative_id, l.demand_landing_page_id
    into v from public.crm_leads l
   where l.id = new.lead_id and l.organization_id = new.organization_id;
  if found then
    new.demand_campaign_id := v.demand_campaign_id;
    new.demand_creative_id := v.demand_creative_id;
    new.demand_landing_page_id := v.demand_landing_page_id;
  end if;
  return new;
end
$f$;
revoke execute on function public.fn_venda_origem_do_card() from public, anon, authenticated;
drop trigger if exists trg_venda_origem_do_card on public.crm_sales;
create trigger trg_venda_origem_do_card
  before insert or update of lead_id on public.crm_sales
  for each row execute function public.fn_venda_origem_do_card();

-- Vendas que já existem.
update public.crm_sales s
   set demand_campaign_id = l.demand_campaign_id,
       demand_creative_id = l.demand_creative_id,
       demand_landing_page_id = l.demand_landing_page_id
  from public.crm_leads l
 where l.id = s.lead_id
   and l.organization_id = s.organization_id
   and (s.demand_campaign_id is distinct from l.demand_campaign_id
        or s.demand_creative_id is distinct from l.demand_creative_id
        or s.demand_landing_page_id is distinct from l.demand_landing_page_id);
