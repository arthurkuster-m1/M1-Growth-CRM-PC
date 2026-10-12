-- manifest: **Vendas com itens, parcelas e venda automática.** `crm_sale_items` (vários produtos numa venda) e `crm_sale_payments` (parcelas/recebimentos com data e valor: o dinheiro só conta quando entra); status da venda derivado das parcelas; `crm_sales` ganha forma de pagamento, parcelas, `closed_on` e `needs_details`; `demand_campaigns` ganha produto e ticket previsto. Triggers: lead que entra numa campanha com ticket cria a venda de INTERESSE; lead ganho efetiva a venda (pedindo os detalhes na tela). Os totais do cliente passam a sair das parcelas.

alter table public.demand_campaigns
  add column if not exists product_name text not null default '',
  add column if not exists ticket_cents bigint;
alter table public.demand_campaigns drop constraint if exists demand_campaigns_ticket_check;
alter table public.demand_campaigns add constraint demand_campaigns_ticket_check
  check ((ticket_cents is null or ticket_cents >= 0) and length(product_name) <= 200);

alter table public.crm_sales
  add column if not exists payment_method text not null default '',
  add column if not exists installments integer not null default 1,
  add column if not exists closed_on date,
  add column if not exists needs_details boolean not null default false;
alter table public.crm_sales drop constraint if exists crm_sales_installments_check;
alter table public.crm_sales add constraint crm_sales_installments_check
  check (installments between 1 and 120 and length(payment_method) <= 60);

create table if not exists public.crm_sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.crm_sales(id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  amount_cents bigint not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint crm_sale_items_check
    check (quantity between 1 and 10000 and amount_cents >= 0 and length(btrim(product_name)) between 1 and 200)
);
create index if not exists crm_sale_items_sale_idx on public.crm_sale_items (sale_id, position);

create table if not exists public.crm_sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.crm_sales(id) on delete cascade,
  number integer not null default 1,
  due_on date not null,
  paid_on date,
  amount_cents bigint not null default 0,
  status text not null default 'prevista',
  created_at timestamptz not null default now(),
  constraint crm_sale_payments_check
    check (status in ('prevista', 'recebida', 'cancelada') and amount_cents >= 0 and number >= 1)
);
create index if not exists crm_sale_payments_sale_idx on public.crm_sale_payments (sale_id, due_on);
create index if not exists crm_sale_payments_org_due_idx
  on public.crm_sale_payments (organization_id, status, due_on);

-- RLS: a equipe do CRM (agent+) lê e escreve.
do $$
declare t text;
begin
  foreach t in array array['crm_sale_items', 'crm_sale_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$create policy %I on public.%I for select using (
      ((organization_id in (select public.fn_user_org_ids()))
       and public.fn_role_at_least(organization_id, 'agent'))
      or public.fn_is_platform_admin())$p$, t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I
      using (public.fn_is_platform_admin_full()
        or ((organization_id in (select public.fn_user_org_ids()))
            and public.fn_role_at_least(organization_id, 'agent')))
      with check (public.fn_is_platform_admin_full()
        or ((organization_id in (select public.fn_user_org_ids()))
            and public.fn_role_at_least(organization_id, 'agent')))$p$, t || '_write', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Totais do cliente: saem das PARCELAS (o dinheiro conta quando entra) ─────────────────────
create or replace function public.fn_crm_sales_refresh_contact(p_org uuid, p_contact uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_ltv bigint; v_prev bigint; v_int bigint; v_n integer; v_first date; v_last date;
begin
  with vendas as (
    select s.id, s.status, s.amount_cents, s.closed_on, s.paid_on,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida'), 0) as pago,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista'), 0) as previsto,
           count(p.id) filter (where p.status <> 'cancelada') as parcelas
      from public.crm_sales s
      left join public.crm_sale_payments p on p.sale_id = s.id
     where s.organization_id = p_org and s.contact_id = p_contact
     group by s.id
  )
  select
    coalesce(sum(case when status in ('comprometida', 'concluida')
                      then case when parcelas = 0 and status = 'concluida' then amount_cents else pago end
                      else 0 end), 0),
    coalesce(sum(case when status in ('comprometida', 'concluida')
                      then case when parcelas = 0 and status = 'comprometida' then amount_cents else previsto end
                      else 0 end), 0),
    coalesce(sum(amount_cents) filter (where status = 'interesse'), 0),
    count(*) filter (where status in ('comprometida', 'concluida'))::integer,
    min(coalesce(closed_on, paid_on)) filter (where status in ('comprometida', 'concluida')),
    max(coalesce(closed_on, paid_on)) filter (where status in ('comprometida', 'concluida'))
    into v_ltv, v_prev, v_int, v_n, v_first, v_last
    from vendas;

  update public.contacts
     set ltv_cents = v_ltv,
         ltv_forecast_cents = v_ltv + v_prev,
         interest_cents = v_int,
         sales_count = v_n,
         last_purchase_on = v_last,
         first_purchase_on = coalesce(v_first, first_purchase_on)
   where id = p_contact and organization_id = p_org;
end
$f$;

-- ── Itens: o valor da venda é a soma deles ───────────────────────────────────────────────
create or replace function public.fn_crm_sale_items_after_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_sale uuid := coalesce(new.sale_id, old.sale_id);
  v_total bigint; v_nomes text; v_n integer;
begin
  select coalesce(sum(amount_cents), 0), count(*),
         string_agg(product_name, ' + ' order by position, created_at)
    into v_total, v_n, v_nomes
    from public.crm_sale_items where sale_id = v_sale;
  if v_n > 0 then
    update public.crm_sales
       set amount_cents = v_total, product_name = left(v_nomes, 200)
     where id = v_sale;
  end if;
  return coalesce(new, old);
end
$f$;
revoke execute on function public.fn_crm_sale_items_after_write() from public, anon, authenticated;
drop trigger if exists trg_crm_sale_items_after_write on public.crm_sale_items;
create trigger trg_crm_sale_items_after_write
  after insert or update or delete on public.crm_sale_items
  for each row execute function public.fn_crm_sale_items_after_write();

-- ── Parcelas: data de recebimento e o status da venda ────────────────────────────────────────
create or replace function public.fn_crm_sale_payments_before_write()
returns trigger language plpgsql set search_path = public as $f$
begin
  if new.status = 'recebida' and new.paid_on is null then
    new.paid_on := current_date;
  end if;
  if new.status <> 'recebida' then
    new.paid_on := null;
  end if;
  return new;
end
$f$;
drop trigger if exists trg_crm_sale_payments_before_write on public.crm_sale_payments;
create trigger trg_crm_sale_payments_before_write
  before insert or update on public.crm_sale_payments
  for each row execute function public.fn_crm_sale_payments_before_write();

create or replace function public.fn_crm_sale_payments_after_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_sale uuid := coalesce(new.sale_id, old.sale_id);
  v_total integer; v_ok integer; v_prox date; v_ult date;
begin
  select count(*) filter (where status <> 'cancelada')::integer,
         count(*) filter (where status = 'recebida')::integer,
         min(due_on) filter (where status = 'prevista'),
         max(paid_on) filter (where status = 'recebida')
    into v_total, v_ok, v_prox, v_ult
    from public.crm_sale_payments where sale_id = v_sale;

  update public.crm_sales s
     set expected_on = v_prox,
         paid_on = v_ult,
         status = case
           when s.status in ('comprometida', 'concluida') and v_total > 0 and v_ok = v_total then 'concluida'
           when s.status in ('comprometida', 'concluida') and v_total > 0 then 'comprometida'
           else s.status end
   where s.id = v_sale;
  return coalesce(new, old);
end
$f$;
revoke execute on function public.fn_crm_sale_payments_after_write() from public, anon, authenticated;
drop trigger if exists trg_crm_sale_payments_after_write on public.crm_sale_payments;
create trigger trg_crm_sale_payments_after_write
  after insert or update or delete on public.crm_sale_payments
  for each row execute function public.fn_crm_sale_payments_after_write();

-- ── Venda: data do fechamento ───────────────────────────────────────────────────────────
create or replace function public.fn_crm_sales_before_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_ref timestamptz;
  v_lead record;
begin
  new.updated_at := now();
  if new.status in ('comprometida', 'concluida') and new.closed_on is null then
    new.closed_on := coalesce(new.paid_on, current_date);
  end if;
  if new.status = 'concluida' and new.paid_on is null then
    new.paid_on := current_date;
  end if;

  if tg_op = 'INSERT' and new.lead_id is null then
    -- A venda segue o ÚLTIMO funil em que o cliente se cadastrou até a data dela.
    v_ref := coalesce(new.closed_on::timestamptz + interval '1 day' - interval '1 second', now());
    select l.id, l.pipeline_id, l.demand_campaign_id, l.demand_landing_page_id, l.demand_creative_id
      into v_lead
      from public.crm_leads l
     where l.organization_id = new.organization_id
       and l.contact_id = new.contact_id
       and l.created_at <= v_ref
     order by l.created_at desc
     limit 1;
    if found then
      new.lead_id := v_lead.id;
      new.pipeline_id := coalesce(new.pipeline_id, v_lead.pipeline_id);
      new.demand_campaign_id := coalesce(new.demand_campaign_id, v_lead.demand_campaign_id);
      new.demand_landing_page_id := coalesce(new.demand_landing_page_id, v_lead.demand_landing_page_id);
      new.demand_creative_id := coalesce(new.demand_creative_id, v_lead.demand_creative_id);
    end if;
  end if;
  return new;
end
$f$;

-- ── Lead que entra numa campanha com ticket: nasce a venda de INTERESSE ─────────────────────
create or replace function public.fn_lead_interest_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_c record;
begin
  if new.demand_campaign_id is null or new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.demand_campaign_id is not distinct from new.demand_campaign_id then
    return new;
  end if;
  select c.id, c.product_name, c.ticket_cents into v_c
    from public.demand_campaigns c
   where c.id = new.demand_campaign_id and c.organization_id = new.organization_id;
  if not found or coalesce(v_c.ticket_cents, 0) <= 0 then
    return new;
  end if;
  if exists (select 1 from public.crm_sales s where s.lead_id = new.id) then
    return new;
  end if;
  insert into public.crm_sales
    (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
     demand_landing_page_id, demand_creative_id, product_name, amount_cents, status)
  values
    (new.organization_id, new.contact_id, new.id, new.pipeline_id, new.demand_campaign_id,
     new.demand_landing_page_id, new.demand_creative_id, coalesce(v_c.product_name, ''),
     v_c.ticket_cents, 'interesse');
  return new;
end
$f$;
revoke execute on function public.fn_lead_interest_sale() from public, anon, authenticated;
drop trigger if exists trg_lead_interest_sale on public.crm_leads;
create trigger trg_lead_interest_sale
  after insert or update of demand_campaign_id on public.crm_leads
  for each row execute function public.fn_lead_interest_sale();

-- ── Lead GANHO: a venda é efetivada (e a tela pede os detalhes) ──────────────────────────────
create or replace function public.fn_lead_won_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_sale uuid;
  v_valor bigint := coalesce(new.value_cents, 0);
begin
  if new.status <> 'won' or old.status = 'won' or new.contact_id is null then
    return new;
  end if;
  select s.id into v_sale
    from public.crm_sales s
   where s.lead_id = new.id and s.status = 'interesse'
   order by s.created_at desc limit 1;
  if v_sale is not null then
    update public.crm_sales
       set status = 'comprometida',
           amount_cents = case when v_valor > 0 then v_valor else amount_cents end,
           needs_details = true,
           closed_on = current_date
     where id = v_sale;
  elsif not exists (
    select 1 from public.crm_sales s where s.lead_id = new.id and s.status in ('comprometida', 'concluida')
  ) then
    insert into public.crm_sales
      (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
       demand_landing_page_id, demand_creative_id, product_name, amount_cents,
       status, needs_details, closed_on)
    values
      (new.organization_id, new.contact_id, new.id, new.pipeline_id, new.demand_campaign_id,
       new.demand_landing_page_id, new.demand_creative_id, left(coalesce(new.title, ''), 200),
       v_valor, 'comprometida', true, current_date);
  end if;
  return new;
end
$f$;
revoke execute on function public.fn_lead_won_sale() from public, anon, authenticated;
drop trigger if exists trg_lead_won_sale on public.crm_leads;
create trigger trg_lead_won_sale
  after update of status on public.crm_leads
  for each row execute function public.fn_lead_won_sale();

comment on table public.crm_sale_items is 'Produtos de uma venda (uma compra pode ter vários). O valor da venda é a soma.';
comment on table public.crm_sale_payments is 'Parcelas/recebimentos de uma venda: o dinheiro só conta no mês em que entra. status prevista, recebida ou cancelada.';
comment on column public.crm_sales.needs_details is 'Venda efetivada automaticamente (lead ganho) que ainda precisa de produto, valor e forma de pagamento.';

notify pgrst, 'reload schema';
