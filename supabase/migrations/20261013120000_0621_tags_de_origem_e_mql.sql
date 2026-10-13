-- manifest: **Tags do lead pela origem e pelo MQL; anotação fixada.** Quando um negócio ganha campanha, criativo ou página de captura, o contato recebe as tags `Campanha: …`, `Ad: …` e `LP: …` (só somam: mostram por onde o lead passou); quando vira MQL recebe a tag `MQL` (e perde ao deixar de ser). A comparação ignora caixa, para não duplicar a tag que a tela já normalizou. `lead_notes.pinned` marca a anotação importante, que a Visão geral da ficha mostra primeiro.

-- Soma uma tag ao contato sem repetir (ignora maiúsculas/minúsculas).
create or replace function public.fn_contato_soma_tag(p_contact uuid, p_org uuid, p_tag text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_contact is null or p_tag is null or btrim(p_tag) = '' then return; end if;
  update public.contacts
     set tags = array_append(coalesce(tags, '{}'::text[]), left(btrim(p_tag), 60))
   where id = p_contact
     and organization_id = p_org
     and not is_anonymized
     and not exists (
       select 1 from unnest(coalesce(tags, '{}'::text[])) x
        where lower(x) = lower(left(btrim(p_tag), 60))
     );
end
$$;

revoke all on function public.fn_contato_soma_tag(uuid, uuid, text) from public, anon, authenticated;

-- A tag do funil passa a usar o mesmo somador (não duplica "Funil: x" depois que a tela normaliza).
create or replace function public.fn_lead_tag_do_funil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if new.contact_id is null then return new; end if;
  select name into v_nome from public.crm_pipelines where id = new.pipeline_id;
  if v_nome is null then return new; end if;
  perform public.fn_contato_soma_tag(new.contact_id, new.organization_id, 'Funil: ' || v_nome);
  return new;
end
$$;

-- Origem do negócio → tags do contato.
create or replace function public.fn_lead_tags_de_origem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if new.contact_id is null then return new; end if;

  if new.demand_campaign_id is not null
     and (tg_op = 'INSERT' or new.demand_campaign_id is distinct from old.demand_campaign_id) then
    select name into v_nome from public.demand_campaigns
     where id = new.demand_campaign_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id, 'Campanha: ' || v_nome);
    end if;
  end if;

  if new.demand_creative_id is not null
     and (tg_op = 'INSERT' or new.demand_creative_id is distinct from old.demand_creative_id) then
    select name into v_nome from public.demand_campaign_creatives
     where id = new.demand_creative_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id, 'Ad: ' || v_nome);
    end if;
  end if;

  if new.demand_landing_page_id is not null
     and (tg_op = 'INSERT' or new.demand_landing_page_id is distinct from old.demand_landing_page_id) then
    select name into v_nome from public.demand_campaign_landing_pages
     where id = new.demand_landing_page_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id, 'LP: ' || v_nome);
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists trg_crm_leads_tags_de_origem on public.crm_leads;
create trigger trg_crm_leads_tags_de_origem
  after insert or update of demand_campaign_id, demand_creative_id, demand_landing_page_id
  on public.crm_leads
  for each row execute function public.fn_lead_tags_de_origem();

-- MQL → tag `MQL` no contato.
create or replace function public.fn_contato_tag_mql()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_anonymized then return new; end if;
  if new.is_mql then
    if not exists (select 1 from unnest(coalesce(new.tags, '{}'::text[])) x where lower(x) = 'mql') then
      new.tags := array_append(coalesce(new.tags, '{}'::text[]), 'MQL');
    end if;
  else
    new.tags := array(select x from unnest(coalesce(new.tags, '{}'::text[])) x where lower(x) <> 'mql');
  end if;
  return new;
end
$$;

drop trigger if exists trg_contato_tag_mql on public.contacts;
create trigger trg_contato_tag_mql
  before insert or update of is_mql on public.contacts
  for each row execute function public.fn_contato_tag_mql();

-- Anotação importante (fixada).
alter table public.lead_notes
  add column if not exists pinned boolean not null default false;

-- O que já existe: as tags de origem dos negócios atribuídos e a tag dos MQL.
do $$
declare
  r record;
begin
  for r in
    select l.contact_id, l.organization_id,
           c.name as campanha, k.name as criativo, p.name as pagina
      from public.crm_leads l
      left join public.demand_campaigns c on c.id = l.demand_campaign_id
      left join public.demand_campaign_creatives k on k.id = l.demand_creative_id
      left join public.demand_campaign_landing_pages p on p.id = l.demand_landing_page_id
     where l.contact_id is not null
       and (l.demand_campaign_id is not null or l.demand_creative_id is not null
            or l.demand_landing_page_id is not null)
  loop
    if r.campanha is not null then
      perform public.fn_contato_soma_tag(r.contact_id, r.organization_id, 'Campanha: ' || r.campanha);
    end if;
    if r.criativo is not null then
      perform public.fn_contato_soma_tag(r.contact_id, r.organization_id, 'Ad: ' || r.criativo);
    end if;
    if r.pagina is not null then
      perform public.fn_contato_soma_tag(r.contact_id, r.organization_id, 'LP: ' || r.pagina);
    end if;
  end loop;
end
$$;

update public.contacts
   set tags = array_append(coalesce(tags, '{}'::text[]), 'MQL')
 where is_mql
   and not is_anonymized
   and not exists (select 1 from unnest(coalesce(tags, '{}'::text[])) x where lower(x) = 'mql');

notify pgrst, 'reload schema';
