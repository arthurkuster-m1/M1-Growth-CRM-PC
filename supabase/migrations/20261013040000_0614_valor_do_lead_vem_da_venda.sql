-- manifest: **O valor do card vem das vendas.** `crm_leads.value_cents` passa a ser a soma das vendas não canceladas da passagem (`crm_sales.lead_id`): escrever o valor grava na venda de interesse/comprometida (triggers `fn_crm_leads_valor_before`, `fn_crm_leads_valor_inicial`, `fn_crm_sales_valor_do_lead`), e lead que nasce com valor gera a venda de interesse. Valores antigos sem venda viram venda de interesse.
-- 0614 — O valor do card (crm_leads.value_cents) passa a VIR DAS VENDAS.
--
-- Uma pessoa é um lead; em cada funil ela tem uma "passagem" (crm_leads) e todo o dinheiro mora em
-- crm_sales. O valor do card é, portanto, a soma das vendas não canceladas ligadas àquela passagem.
-- Quem escreve value_cents (tela, API, importação, IA) continua escrevendo: o banco leva o número
-- para a venda de interesse/comprometida e devolve a soma. Nada de dois lugares com valores diferentes.

create or replace function public.fn_lead_valor_somado(p_lead uuid)
returns bigint language sql stable security definer set search_path = public as $f$
  select coalesce(sum(s.amount_cents), 0)::bigint
    from public.crm_sales s
   where s.lead_id = p_lead and s.status <> 'cancelada'
$f$;
revoke execute on function public.fn_lead_valor_somado(uuid) from public, anon, authenticated;

-- Leva um valor digitado para a venda da passagem (a de interesse ou comprometida mais recente).
create or replace function public.fn_lead_definir_valor(p_lead uuid, p_cents bigint)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_lead record;
  v_sale record;
  v_n integer;
  v_outros bigint;
  v_primeiro uuid;
begin
  select id, organization_id, contact_id, pipeline_id, demand_campaign_id,
         demand_landing_page_id, demand_creative_id, title
    into v_lead from public.crm_leads where id = p_lead;
  if not found or v_lead.contact_id is null then
    return;
  end if;
  select s.id, s.status into v_sale
    from public.crm_sales s
   where s.lead_id = p_lead and s.status in ('interesse', 'comprometida')
   order by s.created_at desc limit 1;

  if found then
    if coalesce(p_cents, 0) <= 0 then
      if v_sale.status = 'interesse' then
        update public.crm_sales set status = 'cancelada' where id = v_sale.id;
      end if;
      return;
    end if;
    select count(*) into v_n from public.crm_sale_items where sale_id = v_sale.id;
    if v_n > 0 then
      select id into v_primeiro from public.crm_sale_items
       where sale_id = v_sale.id order by position, created_at limit 1;
      select coalesce(sum(amount_cents), 0) into v_outros
        from public.crm_sale_items where sale_id = v_sale.id and id <> v_primeiro;
      update public.crm_sale_items
         set amount_cents = greatest(p_cents - v_outros, 0) where id = v_primeiro;
    else
      update public.crm_sales set amount_cents = p_cents where id = v_sale.id;
    end if;
  elsif coalesce(p_cents, 0) > 0 then
    insert into public.crm_sales
      (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
       demand_landing_page_id, demand_creative_id, product_name, amount_cents, status)
    values
      (v_lead.organization_id, v_lead.contact_id, v_lead.id, v_lead.pipeline_id,
       v_lead.demand_campaign_id, v_lead.demand_landing_page_id, v_lead.demand_creative_id,
       left(coalesce(v_lead.title, ''), 200), p_cents, 'interesse');
  end if;
end
$f$;
revoke execute on function public.fn_lead_definir_valor(uuid, bigint) from public, anon, authenticated;

-- Escrita direta em value_cents: vira venda, e o campo guarda a soma.
create or replace function public.fn_crm_leads_valor_before()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if coalesce(current_setting('m1.valor_sync', true), '') = 'on' then
    return new;
  end if;
  if new.value_cents is not distinct from old.value_cents then
    return new;
  end if;
  perform set_config('m1.valor_sync', 'on', true);
  perform public.fn_lead_definir_valor(new.id, coalesce(new.value_cents, 0));
  perform set_config('m1.valor_sync', 'off', true);
  new.value_cents := nullif(public.fn_lead_valor_somado(new.id), 0);
  return new;
end
$f$;
revoke execute on function public.fn_crm_leads_valor_before() from public, anon, authenticated;
drop trigger if exists trg_crm_leads_valor_before on public.crm_leads;
create trigger trg_crm_leads_valor_before
  before update of value_cents on public.crm_leads
  for each row execute function public.fn_crm_leads_valor_before();

-- Lead que nasce com valor: nasce a venda de interesse.
create or replace function public.fn_crm_leads_valor_inicial()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if coalesce(new.value_cents, 0) > 0 and new.contact_id is not null
     and not exists (select 1 from public.crm_sales s where s.lead_id = new.id) then
    perform set_config('m1.valor_sync', 'on', true);
    perform public.fn_lead_definir_valor(new.id, new.value_cents);
    perform set_config('m1.valor_sync', 'off', true);
  end if;
  return new;
end
$f$;
revoke execute on function public.fn_crm_leads_valor_inicial() from public, anon, authenticated;
drop trigger if exists trg_crm_leads_valor_inicial on public.crm_leads;
create trigger trg_crm_leads_valor_inicial
  after insert on public.crm_leads
  for each row execute function public.fn_crm_leads_valor_inicial();

-- Venda mudou: o valor do card acompanha.
create or replace function public.fn_crm_sales_valor_do_lead()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_lead uuid;
  v_ids uuid[] := '{}';
begin
  if coalesce(current_setting('m1.valor_sync', true), '') = 'on' then
    return null;
  end if;
  if tg_op <> 'INSERT' and old.lead_id is not null then
    v_ids := v_ids || old.lead_id;
  end if;
  if tg_op <> 'DELETE' and new.lead_id is not null and not (new.lead_id = any (v_ids)) then
    v_ids := v_ids || new.lead_id;
  end if;
  perform set_config('m1.valor_sync', 'on', true);
  foreach v_lead in array v_ids loop
    update public.crm_leads
       set value_cents = nullif(public.fn_lead_valor_somado(v_lead), 0)
     where id = v_lead
       and value_cents is distinct from nullif(public.fn_lead_valor_somado(v_lead), 0);
  end loop;
  perform set_config('m1.valor_sync', 'off', true);
  return null;
end
$f$;
revoke execute on function public.fn_crm_sales_valor_do_lead() from public, anon, authenticated;
drop trigger if exists trg_crm_sales_valor_do_lead on public.crm_sales;
create trigger trg_crm_sales_valor_do_lead
  after insert or update of amount_cents, status, lead_id or delete on public.crm_sales
  for each row execute function public.fn_crm_sales_valor_do_lead();

-- Quem já tinha valor no card e nenhuma venda: o valor vira uma venda de interesse.
do $m$
declare r record;
begin
  perform set_config('m1.valor_sync', 'on', true);
  for r in
    select l.id, l.value_cents from public.crm_leads l
     where coalesce(l.value_cents, 0) > 0 and l.contact_id is not null
       and not exists (select 1 from public.crm_sales s where s.lead_id = l.id)
  loop
    perform public.fn_lead_definir_valor(r.id, r.value_cents);
  end loop;
  -- E o card passa a mostrar a soma das vendas.
  update public.crm_leads l
     set value_cents = nullif(public.fn_lead_valor_somado(l.id), 0)
   where exists (select 1 from public.crm_sales s where s.lead_id = l.id)
     and l.value_cents is distinct from nullif(public.fn_lead_valor_somado(l.id), 0);
  perform set_config('m1.valor_sync', 'off', true);
end
$m$;

comment on column public.crm_leads.value_cents is
  'Valor do card = soma das vendas não canceladas da passagem (crm_sales.lead_id). Escrever aqui grava na venda de interesse/comprometida.';

notify pgrst, 'reload schema';
