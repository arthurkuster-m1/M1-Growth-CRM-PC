-- manifest: **O card nasce com a origem do lead.** Um card novo de um contato que já tem cards (outro funil, venda adicional, "adicionar ao funil") herda a ORIGEM do lead — a do cadastro mais antigo dele (fonte, campanha, anúncio, landing page, conjunto, posicionamento) — em vez de pegar só a campanha do funil em que caiu. Vale só quando o card nasce sem origem própria; quem informa a origem na criação, ou a altera depois à mão (card ou venda), mantém a sua. Roda antes de `trg_lead_herda_campanha_do_funil`, que continua valendo para o contato novo, sem cadastro anterior.

create or replace function public.fn_card_herda_origem_do_lead()
returns trigger language plpgsql security definer set search_path = public as $f$
declare v record;
begin
  if new.contact_id is null then return new; end if;
  -- Origem própria informada na criação: respeita.
  if new.demand_campaign_id is not null
     or new.demand_creative_id is not null
     or new.demand_landing_page_id is not null then
    return new;
  end if;
  select l.source, l.source_metadata, l.demand_campaign_id, l.demand_creative_id, l.demand_landing_page_id
    into v
    from public.crm_leads l
   where l.organization_id = new.organization_id
     and l.contact_id = new.contact_id
   order by (l.demand_campaign_id is not null) desc, l.created_at asc
   limit 1;
  if not found then return new; end if;
  new.demand_campaign_id := v.demand_campaign_id;
  new.demand_creative_id := v.demand_creative_id;
  new.demand_landing_page_id := v.demand_landing_page_id;
  if new.source is null or new.source in ('manual', '') then
    new.source := v.source;
  end if;
  if new.source_metadata is null or new.source_metadata = '{}'::jsonb then
    new.source_metadata := coalesce(v.source_metadata, '{}'::jsonb);
  elsif v.source_metadata ? 'origem_manual' and not (new.source_metadata ? 'origem_manual') then
    new.source_metadata := new.source_metadata || jsonb_build_object('origem_manual', v.source_metadata -> 'origem_manual');
  end if;
  return new;
end
$f$;
revoke execute on function public.fn_card_herda_origem_do_lead() from public, anon, authenticated;

drop trigger if exists trg_lead_a_origem_do_lead on public.crm_leads;
create trigger trg_lead_a_origem_do_lead
  before insert on public.crm_leads
  for each row execute function public.fn_card_herda_origem_do_lead();
