-- manifest: **Lead nascido no funil de uma campanha herda a campanha.** Trigger em `crm_leads`: ao inserir um lead sem `demand_campaign_id` num funil que pertence a uma campanha de demanda, a campanha é gravada (cadastro manual, importação, API, automação). Preenche também os leads que já estavam nesses funis.

create or replace function public.fn_lead_herda_campanha_do_funil()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.demand_campaign_id is null then
    select c.id into new.demand_campaign_id
      from public.demand_campaigns c
     where c.organization_id = new.organization_id
       and c.pipeline_id = new.pipeline_id
     limit 1;
  end if;
  return new;
end
$f$;

revoke execute on function public.fn_lead_herda_campanha_do_funil() from public, anon, authenticated;

drop trigger if exists trg_lead_herda_campanha_do_funil on public.crm_leads;
create trigger trg_lead_herda_campanha_do_funil
  before insert on public.crm_leads
  for each row execute function public.fn_lead_herda_campanha_do_funil();

update public.crm_leads l
   set demand_campaign_id = c.id
  from public.demand_campaigns c
 where l.demand_campaign_id is null
   and c.organization_id = l.organization_id
   and c.pipeline_id = l.pipeline_id;

notify pgrst, 'reload schema';
