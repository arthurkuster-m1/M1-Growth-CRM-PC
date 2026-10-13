-- manifest: **A venda é o card do funil.** Um contato pode ter MAIS DE UM card aberto no mesmo funil quando há mais de uma venda (`crm_leads.venda_adicional`; o índice de lead único passa a valer só para o card principal). Todo negócio (card) passa a ter ao menos uma venda atrelada (nasce uma de interesse, valor 0, quando não há), e a previsão de fechamento e a descrição passam a ser campos da VENDA (`crm_sales.expected_close_date` / `description`). Para nada quebrar, a venda principal do card (a mais antiga) e o card ficam espelhados nos dois sentidos — editar num lado aparece no outro. Quem tem duas vendas no mesmo funil tem dois cards, cada um na sua etapa.

-- Segundo (terceiro…) card do mesmo contato no mesmo funil: uma venda a mais, na sua própria etapa.
alter table public.crm_leads
  add column if not exists venda_adicional boolean not null default false;

drop index if exists public.uniq_crm_leads_open_contact_pipeline;
create unique index if not exists uniq_crm_leads_open_contact_pipeline
  on public.crm_leads (organization_id, contact_id, pipeline_id)
  where status = 'open' and contact_id is not null and not venda_adicional;

alter table public.crm_sales
  add column if not exists expected_close_date date;

comment on column public.crm_sales.expected_close_date is
  'Previsão de fechamento da venda (era do negócio). Espelhada no card (crm_leads.expected_close_date) para a venda principal.';

-- A venda principal do card: a mais antiga.
create or replace function public.fn_venda_principal(p_lead uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select s.id from public.crm_sales s where s.lead_id = p_lead order by s.created_at, s.id limit 1
$$;

-- venda → card
create or replace function public.fn_sync_venda_para_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is null then return new; end if;
  if coalesce(current_setting('m1.previsao_sync', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' and new.expected_close_date is null and coalesce(new.description, '') = '' then
    return new;
  end if;
  if public.fn_venda_principal(new.lead_id) is distinct from new.id then return new; end if;
  perform set_config('m1.previsao_sync', 'on', true);
  update public.crm_leads
     set expected_close_date = new.expected_close_date,
         description = nullif(new.description, '')
   where id = new.lead_id
     and organization_id = new.organization_id
     and (expected_close_date is distinct from new.expected_close_date
          or description is distinct from nullif(new.description, ''));
  perform set_config('m1.previsao_sync', 'off', true);
  return new;
end
$$;

drop trigger if exists trg_venda_para_card on public.crm_sales;
create trigger trg_venda_para_card
  after insert or update of expected_close_date, description on public.crm_sales
  for each row execute function public.fn_sync_venda_para_card();

-- card → venda principal
create or replace function public.fn_sync_card_para_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda uuid;
begin
  if coalesce(current_setting('m1.previsao_sync', true), '') = 'on' then return new; end if;
  v_venda := public.fn_venda_principal(new.id);
  if v_venda is null then return new; end if;
  perform set_config('m1.previsao_sync', 'on', true);
  update public.crm_sales
     set expected_close_date = new.expected_close_date,
         description = coalesce(new.description, '')
   where id = v_venda
     and organization_id = new.organization_id
     and (expected_close_date is distinct from new.expected_close_date
          or description is distinct from coalesce(new.description, ''));
  perform set_config('m1.previsao_sync', 'off', true);
  return new;
end
$$;

drop trigger if exists trg_card_para_venda on public.crm_leads;
create trigger trg_card_para_venda
  after update of expected_close_date, description on public.crm_leads
  for each row execute function public.fn_sync_card_para_venda();

-- Todo card tem ao menos uma venda: nasce uma de interesse (roda depois dos gatilhos que já criam
-- a venda pela campanha ou pelo valor — só cria quando ainda não há nenhuma).
create or replace function public.fn_lead_venda_minima()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is null then return new; end if;
  if exists (select 1 from public.crm_sales s where s.lead_id = new.id) then return new; end if;
  perform set_config('m1.previsao_sync', 'on', true);
  insert into public.crm_sales
    (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
     demand_landing_page_id, demand_creative_id, product_name, description,
     amount_cents, status, expected_close_date)
  values
    (new.organization_id, new.contact_id, new.id, new.pipeline_id, new.demand_campaign_id,
     new.demand_landing_page_id, new.demand_creative_id, left(coalesce(new.title, ''), 200),
     coalesce(new.description, ''), 0, 'interesse', new.expected_close_date);
  perform set_config('m1.previsao_sync', 'off', true);
  return new;
end
$$;

drop trigger if exists trg_lead_venda_minima on public.crm_leads;
create trigger trg_lead_venda_minima
  after insert on public.crm_leads
  for each row execute function public.fn_lead_venda_minima();

-- O que já existe: a venda mínima dos cards sem venda e a previsão/descrição copiadas do card.
do $$
begin
  perform set_config('m1.previsao_sync', 'on', true);

  insert into public.crm_sales
    (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
     demand_landing_page_id, demand_creative_id, product_name, description,
     amount_cents, status, expected_close_date)
  select l.organization_id, l.contact_id, l.id, l.pipeline_id, l.demand_campaign_id,
         l.demand_landing_page_id, l.demand_creative_id, left(coalesce(l.title, ''), 200),
         coalesce(l.description, ''), 0,
         case when l.status = 'won' then 'comprometida' else 'interesse' end,
         l.expected_close_date
    from public.crm_leads l
   where l.contact_id is not null
     and not exists (select 1 from public.crm_sales s where s.lead_id = l.id);

  update public.crm_sales s
     set expected_close_date = l.expected_close_date,
         description = case when coalesce(s.description, '') = '' then coalesce(l.description, '')
                            else s.description end
    from public.crm_leads l
   where s.lead_id = l.id
     and s.id = public.fn_venda_principal(l.id)
     and (s.expected_close_date is distinct from l.expected_close_date
          or (coalesce(s.description, '') = '' and coalesce(l.description, '') <> ''));

  perform set_config('m1.previsao_sync', 'off', true);
end
$$;

notify pgrst, 'reload schema';
