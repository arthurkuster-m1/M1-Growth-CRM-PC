-- manifest: **Passo 7, Fase A: oportunidade única (aditiva, nada muda na tela).** O card (`crm_leads`) ganha os campos da venda (`is_recurring`, `recurrence_active`, `recurrence_ahead`, `payment_method`, `installments`, `reference`, `notes`, `paid_on`), mantidos por trigger a partir da venda principal; itens e parcelas ganham `lead_id` (preenchido do `sale.lead_id`, e por trigger nas novas); o único card com duas vendas vira duas oportunidades (a venda paga vai para um card novo na etapa Comprou); e `fn_oportunidade_unica_divergencias()` confere que card, itens e parcelas batem com a venda.

-- ── 1. Os campos da venda dentro do card ────────────────────────────────────
alter table public.crm_leads
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_active boolean not null default false,
  add column if not exists recurrence_ahead smallint not null default 1,
  add column if not exists payment_method text not null default '',
  add column if not exists installments integer not null default 1,
  add column if not exists reference text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists paid_on date;

alter table public.crm_leads drop constraint if exists crm_leads_recurrence_ahead_check;
alter table public.crm_leads add constraint crm_leads_recurrence_ahead_check
  check (recurrence_ahead between 1 and 12);

-- ── 2. Itens e parcelas apontam também para a oportunidade ──────────────────
alter table public.crm_sale_items
  add column if not exists lead_id uuid references public.crm_leads(id) on delete cascade;
alter table public.crm_sale_payments
  add column if not exists lead_id uuid references public.crm_leads(id) on delete cascade;

create index if not exists crm_sale_items_lead_idx on public.crm_sale_items (lead_id);
create index if not exists crm_sale_payments_lead_idx on public.crm_sale_payments (lead_id);

create or replace function public.fn_item_ou_parcela_lead_id()
returns trigger language plpgsql as $f$
begin
  if new.lead_id is null then
    select lead_id into new.lead_id from public.crm_sales where id = new.sale_id;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_sale_items_lead_id on public.crm_sale_items;
create trigger trg_crm_sale_items_lead_id
  before insert on public.crm_sale_items
  for each row execute function public.fn_item_ou_parcela_lead_id();

drop trigger if exists trg_crm_sale_payments_lead_id on public.crm_sale_payments;
create trigger trg_crm_sale_payments_lead_id
  before insert on public.crm_sale_payments
  for each row execute function public.fn_item_ou_parcela_lead_id();

-- A venda muda de card (ex.: a separação em duas oportunidades): itens e parcelas vão junto.
create or replace function public.fn_venda_muda_de_card()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.lead_id is distinct from old.lead_id then
    update public.crm_sale_items set lead_id = new.lead_id where sale_id = new.id;
    update public.crm_sale_payments set lead_id = new.lead_id where sale_id = new.id;
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_venda_muda_de_card() from public, anon, authenticated;

drop trigger if exists trg_venda_muda_de_card on public.crm_sales;
create trigger trg_venda_muda_de_card
  after update of lead_id on public.crm_sales
  for each row execute function public.fn_venda_muda_de_card();

-- ── 3. Venda principal → card (os campos novos) ─────────────────────────────
create or replace function public.fn_venda_para_campos_do_card()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.lead_id is null then return null; end if;
  if public.fn_venda_principal(new.lead_id) is distinct from new.id then return null; end if;
  update public.crm_leads
     set is_recurring = new.is_recurring,
         recurrence_active = new.recurrence_active,
         recurrence_ahead = new.recurrence_ahead,
         payment_method = coalesce(new.payment_method, ''),
         installments = coalesce(new.installments, 1),
         reference = coalesce(new.reference, ''),
         notes = coalesce(new.notes, ''),
         paid_on = new.paid_on::date
   where id = new.lead_id
     and organization_id = new.organization_id
     and (is_recurring is distinct from new.is_recurring
          or recurrence_active is distinct from new.recurrence_active
          or recurrence_ahead is distinct from new.recurrence_ahead
          or payment_method is distinct from coalesce(new.payment_method, '')
          or installments is distinct from coalesce(new.installments, 1)
          or reference is distinct from coalesce(new.reference, '')
          or notes is distinct from coalesce(new.notes, '')
          or paid_on is distinct from new.paid_on::date);
  return null;
end
$f$;
revoke execute on function public.fn_venda_para_campos_do_card() from public, anon, authenticated;

drop trigger if exists trg_venda_para_campos_do_card on public.crm_sales;
create trigger trg_venda_para_campos_do_card
  after insert or update of is_recurring, recurrence_active, recurrence_ahead, payment_method,
    installments, reference, notes, paid_on, lead_id on public.crm_sales
  for each row execute function public.fn_venda_para_campos_do_card();

-- ── 4. O único card com duas vendas vira duas oportunidades ─────────────────
do $$
declare
  r record;
  v_novo uuid;
  v_ganho uuid;
  v_auto record;
begin
  for r in
    select s.id as venda, s.lead_id, s.organization_id, s.created_at
      from public.crm_sales s
     where s.lead_id is not null
       and (select count(*) from public.crm_sales x where x.lead_id = s.lead_id) > 1
       and s.id <> public.fn_venda_principal(s.lead_id)
  loop
    -- A oportunidade nova é uma cópia do card; a venda "extra" vai para ela.
    insert into public.crm_leads
      (organization_id, pipeline_id, stage_id, contact_id, title, description, status, source,
       source_metadata, owner_user_id, owner_kind, demand_campaign_id, demand_landing_page_id,
       demand_creative_id, tags, currency, venda_adicional)
    select organization_id, pipeline_id, stage_id, contact_id, title, description, 'open', source,
           source_metadata, owner_user_id, owner_kind, demand_campaign_id, demand_landing_page_id,
           demand_creative_id, tags, currency, true
      from public.crm_leads where id = r.lead_id
    returning id into v_novo;

    -- A venda mínima que o gatilho criou para o card novo sai (a venda de verdade vai no lugar).
    for v_auto in
      select id from public.crm_sales where lead_id = v_novo and id <> r.venda
    loop
      delete from public.crm_sales where id = v_auto.id;
    end loop;

    update public.crm_sales set lead_id = v_novo where id = r.venda;

    -- Venda paga: a nova oportunidade está em Comprou.
    if exists (
      select 1 from public.crm_sales s
       where s.id = r.venda
         and (s.status = 'concluida'
              or exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id and p.status = 'recebida'))
    ) then
      select id into v_ganho
        from public.crm_stages
       where pipeline_id = (select pipeline_id from public.crm_leads where id = v_novo)
         and is_won and not is_archived
       order by position limit 1;
      if v_ganho is not null then
        update public.crm_leads set stage_id = v_ganho where id = v_novo;
      end if;
    end if;
  end loop;
end
$$;

-- ── 5. Backfill dos campos novos e de lead_id ───────────────────────────────
update public.crm_sale_items i set lead_id = s.lead_id
  from public.crm_sales s where s.id = i.sale_id and i.lead_id is null;
update public.crm_sale_payments p set lead_id = s.lead_id
  from public.crm_sales s where s.id = p.sale_id and p.lead_id is null;

update public.crm_leads l
   set is_recurring = s.is_recurring,
       recurrence_active = s.recurrence_active,
       recurrence_ahead = s.recurrence_ahead,
       payment_method = coalesce(s.payment_method, ''),
       installments = coalesce(s.installments, 1),
       reference = coalesce(s.reference, ''),
       notes = coalesce(s.notes, ''),
       paid_on = s.paid_on::date
  from public.crm_sales s
 where s.id = public.fn_venda_principal(l.id);

-- ── 6. A conferência (deve voltar vazia) ────────────────────────────────────
create or replace function public.fn_oportunidade_unica_divergencias()
returns table (tipo text, quantidade bigint)
language sql stable security definer set search_path = public as $f$
  select 'item_sem_lead_id'::text, count(*) from public.crm_sale_items i
   join public.crm_sales s on s.id = i.sale_id
   where i.lead_id is null and s.lead_id is not null
  union all
  select 'parcela_sem_lead_id', count(*) from public.crm_sale_payments p
   join public.crm_sales s on s.id = p.sale_id
   where p.lead_id is null and s.lead_id is not null
  union all
  select 'item_com_lead_diferente_da_venda', count(*) from public.crm_sale_items i
   join public.crm_sales s on s.id = i.sale_id
   where i.lead_id is distinct from s.lead_id
  union all
  select 'parcela_com_lead_diferente_da_venda', count(*) from public.crm_sale_payments p
   join public.crm_sales s on s.id = p.sale_id
   where p.lead_id is distinct from s.lead_id
  union all
  select 'card_com_mais_de_uma_venda', count(*) from (
    select lead_id from public.crm_sales where lead_id is not null group by 1 having count(*) > 1
  ) x
  union all
  select 'card_diferente_da_venda_principal', count(*) from public.crm_leads l
   join public.crm_sales s on s.id = public.fn_venda_principal(l.id)
   where l.is_recurring is distinct from s.is_recurring
      or l.recurrence_active is distinct from s.recurrence_active
      or l.recurrence_ahead is distinct from s.recurrence_ahead
      or l.payment_method is distinct from coalesce(s.payment_method, '')
      or l.installments is distinct from coalesce(s.installments, 1)
      or l.reference is distinct from coalesce(s.reference, '')
      or l.notes is distinct from coalesce(s.notes, '')
      or l.paid_on is distinct from s.paid_on::date
$f$;
revoke execute on function public.fn_oportunidade_unica_divergencias() from public, anon, authenticated;
grant execute on function public.fn_oportunidade_unica_divergencias() to service_role;

notify pgrst, 'reload schema';
