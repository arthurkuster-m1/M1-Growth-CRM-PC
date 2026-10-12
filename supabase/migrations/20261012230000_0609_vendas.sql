-- manifest: **Vendas (sessão 7 do CRM).** `crm_sales`: cada transação de um cliente (várias por lead, inclusive recorrência), com status (interesse, comprometida, concluída, cancelada), valor, datas prevista e de recebimento, e a origem (funil, campanha, LP e criativo do ÚLTIMO cadastro do cliente até a data da venda). `contacts` ganha os totais calculados por trigger: LTV atual, LTV previsto, valor em interesse, quantidade de vendas e última compra; `first_purchase_on` passa a vir da menor data de venda concluída.

-- ============================================================================
-- 0609 — VENDAS
--
-- Regras do Arthur (12/10/2026):
--  • não existe venda sem cliente: `contact_id` é obrigatório;
--  • cliente tem várias vendas (assessoria de 6 meses = 6 transações);
--  • status: `interesse` (potencial), `comprometida` (prevista, a receber), `concluida`
--    (recebida) e `cancelada`;
--  • a venda é atrelada ao ÚLTIMO funil em que o cliente se cadastrou até a data dela;
--  • o resultado reflete no cliente (LTV atual, LTV previsto) e nas campanhas/LPs/criativos.
-- ============================================================================

create table if not exists public.crm_sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.crm_leads(id) on delete set null,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  demand_campaign_id uuid references public.demand_campaigns(id) on delete set null,
  demand_landing_page_id uuid references public.demand_campaign_landing_pages(id) on delete set null,
  demand_creative_id uuid references public.demand_campaign_creatives(id) on delete set null,
  product_name text not null default '',
  description text not null default '',
  amount_cents bigint not null default 0,
  currency text not null default 'BRL',
  status text not null default 'concluida',
  -- Quando se espera receber (comprometida) e quando foi recebido (concluída).
  expected_on date,
  paid_on date,
  is_recurring boolean not null default false,
  reference text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_sales_status_check
    check (status in ('interesse', 'comprometida', 'concluida', 'cancelada')),
  constraint crm_sales_amount_check check (amount_cents >= 0 and amount_cents <= 100000000000),
  constraint crm_sales_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint crm_sales_texts_check
    check (length(product_name) <= 200 and length(description) <= 2000
           and length(reference) <= 200 and length(notes) <= 2000)
);

create index if not exists crm_sales_org_contact_idx
  on public.crm_sales (organization_id, contact_id, created_at desc);
create index if not exists crm_sales_org_status_idx
  on public.crm_sales (organization_id, status, paid_on desc);
create index if not exists crm_sales_org_campaign_idx
  on public.crm_sales (organization_id, demand_campaign_id) where demand_campaign_id is not null;

-- ── Totais no cliente ───────────────────────────────────────────────────────
alter table public.contacts
  add column if not exists ltv_cents bigint not null default 0,
  add column if not exists ltv_forecast_cents bigint not null default 0,
  add column if not exists interest_cents bigint not null default 0,
  add column if not exists sales_count integer not null default 0,
  add column if not exists last_purchase_on date;

comment on column public.contacts.ltv_cents is
  'LTV atual: soma das vendas CONCLUÍDAS (recebidas). Calculado por trigger a partir de crm_sales.';
comment on column public.contacts.ltv_forecast_cents is
  'LTV previsto: LTV atual + vendas COMPROMETIDAS (previstas). Calculado por trigger.';
comment on column public.contacts.interest_cents is
  'Valor em INTERESSE: vendas ainda não comprometidas (potencial). Calculado por trigger.';

create or replace function public.fn_crm_sales_refresh_contact(p_org uuid, p_contact uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_ltv bigint; v_comp bigint; v_int bigint; v_n integer; v_first date; v_last date;
begin
  select coalesce(sum(amount_cents) filter (where status = 'concluida'), 0),
         coalesce(sum(amount_cents) filter (where status = 'comprometida'), 0),
         coalesce(sum(amount_cents) filter (where status = 'interesse'), 0),
         count(*) filter (where status = 'concluida')::integer,
         min(paid_on) filter (where status = 'concluida'),
         max(paid_on) filter (where status = 'concluida')
    into v_ltv, v_comp, v_int, v_n, v_first, v_last
    from public.crm_sales
   where organization_id = p_org and contact_id = p_contact;

  update public.contacts
     set ltv_cents = v_ltv,
         ltv_forecast_cents = v_ltv + v_comp,
         interest_cents = v_int,
         sales_count = v_n,
         last_purchase_on = v_last,
         first_purchase_on = coalesce(v_first, first_purchase_on)
   where id = p_contact and organization_id = p_org;
end
$f$;

revoke execute on function public.fn_crm_sales_refresh_contact(uuid, uuid) from public, anon, authenticated;

-- ── Antes de gravar: data de recebimento e ORIGEM (último cadastro até a data da venda) ─────
create or replace function public.fn_crm_sales_before_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_ref timestamptz;
  v_lead record;
begin
  new.updated_at := now();
  if new.status = 'concluida' and new.paid_on is null then
    new.paid_on := current_date;
  end if;

  if tg_op = 'INSERT' and new.lead_id is null then
    -- A venda segue o ÚLTIMO funil em que o cliente se cadastrou até a data dela.
    v_ref := coalesce(new.paid_on::timestamptz + interval '1 day' - interval '1 second', now());
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

revoke execute on function public.fn_crm_sales_before_write() from public, anon, authenticated;

drop trigger if exists trg_crm_sales_before_write on public.crm_sales;
create trigger trg_crm_sales_before_write
  before insert or update on public.crm_sales
  for each row execute function public.fn_crm_sales_before_write();

create or replace function public.fn_crm_sales_after_write()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if tg_op = 'DELETE' then
    perform public.fn_crm_sales_refresh_contact(old.organization_id, old.contact_id);
    return old;
  end if;
  perform public.fn_crm_sales_refresh_contact(new.organization_id, new.contact_id);
  if tg_op = 'UPDATE' and old.contact_id is distinct from new.contact_id then
    perform public.fn_crm_sales_refresh_contact(old.organization_id, old.contact_id);
  end if;
  return new;
end
$f$;

revoke execute on function public.fn_crm_sales_after_write() from public, anon, authenticated;

drop trigger if exists trg_crm_sales_after_write on public.crm_sales;
create trigger trg_crm_sales_after_write
  after insert or update or delete on public.crm_sales
  for each row execute function public.fn_crm_sales_after_write();

-- ── RLS: a equipe do CRM (agent+) lê e escreve; viewer não vê dinheiro ──────────────────────
alter table public.crm_sales enable row level security;

drop policy if exists crm_sales_select on public.crm_sales;
create policy crm_sales_select on public.crm_sales
  for select using (
    ((organization_id in (select public.fn_user_org_ids()))
     and public.fn_role_at_least(organization_id, 'agent'))
    or public.fn_is_platform_admin()
  );
drop policy if exists crm_sales_write on public.crm_sales;
create policy crm_sales_write on public.crm_sales
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

revoke all on public.crm_sales from anon;
grant select, insert, update, delete on public.crm_sales to authenticated;

comment on table public.crm_sales is
  'Vendas: cada transação de um cliente (várias por contato, inclusive recorrência). Status interesse, comprometida, concluida ou cancelada. A origem (funil, campanha, LP, criativo) é a do último cadastro do cliente até a data da venda. Os totais vão para contacts por trigger.';

notify pgrst, 'reload schema';
