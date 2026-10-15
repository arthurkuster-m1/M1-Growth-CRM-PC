-- manifest: **Passo 7, Fases B e C (banco): a oportunidade é uma só.** Itens e parcelas passam a viver só na oportunidade (`lead_id`; `sale_id` fica opcional e some depois); o valor, o resumo do contato, o ciclo de vida, o selo de pagamento e a recorrência são calculados a partir da oportunidade e das parcelas; o espelho card↔venda e a venda mínima/ganha deixam de existir (triggers de `crm_sales` e do card removidos); entrar em Comprou exige parcela recebida (`comprou_exige_pagamento`); o índice de um card aberto por pessoa e funil cai (várias oportunidades por pessoa); a venda "concluída" sem parcelas ganha a parcela recebida.

-- ── 0. O nome dado à venda (vazio = os produtos juntados) mora na oportunidade ─
alter table public.crm_leads add column if not exists nome_da_venda text not null default '';
update public.crm_leads l set nome_da_venda = s.name
  from public.crm_sales s
 where s.id = public.fn_venda_principal(l.id) and coalesce(s.name, '') <> '' and l.nome_da_venda = '';

-- ── 1. Dados: venda concluída sem parcela ganha a parcela recebida ──────────
insert into public.crm_sale_payments
  (organization_id, sale_id, lead_id, number, due_on, paid_on, amount_cents, status)
select s.organization_id, s.id, s.lead_id, 1,
       coalesce(s.paid_on::date, s.closed_on::date, current_date),
       coalesce(s.paid_on::date, s.closed_on::date, current_date),
       s.amount_cents, 'recebida'
  from public.crm_sales s
 where s.status = 'concluida' and s.amount_cents > 0
   and not exists (select 1 from public.crm_sale_payments p where p.sale_id = s.id);

-- Venda cancelada: as parcelas abertas dela saem.
update public.crm_sale_payments p set status = 'cancelada'
  from public.crm_sales s
 where s.id = p.sale_id and s.status = 'cancelada' and p.status = 'prevista';

-- ── 2. sale_id deixa de ser obrigatório (a oportunidade é a dona) ───────────
alter table public.crm_sale_items alter column sale_id drop not null;
alter table public.crm_sale_payments alter column sale_id drop not null;

-- ── 3. O espelho sai: triggers de crm_sales e do card ───────────────────────
drop trigger if exists trg_card_origem_para_vendas on public.crm_leads;
drop trigger if exists trg_card_para_venda on public.crm_leads;
drop trigger if exists trg_lead_venda_minima on public.crm_leads;
drop trigger if exists trg_lead_won_sale on public.crm_leads;

drop trigger if exists trg_ciclo_apos_venda on public.crm_sales;
drop trigger if exists trg_com_pagamento_apos_venda on public.crm_sales;
drop trigger if exists trg_crm_sales_after_write on public.crm_sales;
drop trigger if exists trg_crm_sales_before_write on public.crm_sales;
drop trigger if exists trg_crm_sales_recurrence_default on public.crm_sales;
drop trigger if exists trg_crm_sales_valor_do_lead on public.crm_sales;
drop trigger if exists trg_venda_muda_de_card on public.crm_sales;
drop trigger if exists trg_venda_origem_do_card on public.crm_sales;
drop trigger if exists trg_venda_para_campos_do_card on public.crm_sales;
drop trigger if exists trg_venda_para_card on public.crm_sales;

-- Várias oportunidades abertas por pessoa e funil.
drop index if exists public.uniq_crm_leads_open_contact_pipeline;

-- ── 4. Valor: o card é a soma dos itens (sem itens, o valor é o digitado) ───
create or replace function public.fn_crm_sale_items_after_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
  v_total bigint; v_n integer;
begin
  if v_lead is null or coalesce(current_setting('m1.valor_sync', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  select coalesce(sum(amount_cents), 0), count(*) into v_total, v_n
    from public.crm_sale_items where lead_id = v_lead;
  if v_n > 0 then
    perform set_config('m1.valor_sync', 'on', true);
    update public.crm_leads
       set value_cents = nullif(v_total, 0)
     where id = v_lead and value_cents is distinct from nullif(v_total, 0);
    perform set_config('m1.valor_sync', 'off', true);
  end if;
  return coalesce(new, old);
end
$f$;

create or replace function public.fn_crm_leads_valor_before()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_n integer; v_primeiro uuid; v_outros bigint; v_total bigint;
begin
  if coalesce(current_setting('m1.valor_sync', true), '') = 'on' then
    return new;
  end if;
  if new.value_cents is not distinct from old.value_cents then
    return new;
  end if;
  select count(*) into v_n from public.crm_sale_items where lead_id = new.id;
  if v_n > 0 then
    -- Com produtos, o valor é a soma deles: o primeiro absorve a diferença digitada.
    select id into v_primeiro from public.crm_sale_items
     where lead_id = new.id order by position, created_at limit 1;
    select coalesce(sum(amount_cents), 0) into v_outros
      from public.crm_sale_items where lead_id = new.id and id <> v_primeiro;
    perform set_config('m1.valor_sync', 'on', true);
    update public.crm_sale_items
       set amount_cents = greatest(coalesce(new.value_cents, 0) - v_outros, 0)
     where id = v_primeiro;
    perform set_config('m1.valor_sync', 'off', true);
    select coalesce(sum(amount_cents), 0) into v_total from public.crm_sale_items where lead_id = new.id;
    new.value_cents := nullif(v_total, 0);
  end if;
  return new;
end
$f$;

create or replace function public.fn_crm_leads_valor_inicial()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  return new;
end
$f$;

-- ── 5. Recorrência: ligar a assinatura a deixa ativa; perder a desliga ──────
create or replace function public.fn_crm_leads_recurrence_default()
returns trigger language plpgsql set search_path = public as $f$
begin
  if new.is_recurring and (tg_op = 'INSERT' or old.is_recurring is distinct from true) then
    new.recurrence_active := true;
  end if;
  if new.status = 'lost' then
    new.recurrence_active := false;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_leads_recurrence_default on public.crm_leads;
create trigger trg_crm_leads_recurrence_default
  before insert or update of is_recurring, status on public.crm_leads
  for each row execute function public.fn_crm_leads_recurrence_default();

-- ── 6. O resumo do contato, calculado das oportunidades e das parcelas ──────
create or replace function public.fn_crm_sales_refresh_contact(p_org uuid, p_contact uuid)
returns void language plpgsql security definer set search_path = public as $f$
declare
  v_ltv bigint; v_prev bigint; v_int bigint; v_n integer; v_first date; v_last date;
begin
  with ops as (
    select l.id, l.status, coalesce(l.value_cents, 0) as valor,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida'), 0) as pago,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista'), 0) as previsto,
           coalesce(sum(p.amount_cents) filter (where p.status = 'cancelada'), 0) as cancelado,
           count(p.id) filter (where p.status <> 'cancelada') as parcelas,
           count(p.id) filter (where p.status = 'recebida') as recebidas,
           min(p.paid_on) filter (where p.status = 'recebida') as primeira,
           max(p.paid_on) filter (where p.status = 'recebida') as ultima
      from public.crm_leads l
      left join public.crm_sale_payments p on p.lead_id = l.id
     where l.organization_id = p_org and l.contact_id = p_contact
     group by l.id, l.status, l.value_cents
  )
  select
    coalesce(sum(pago), 0),
    coalesce(sum(previsto) filter (where status <> 'lost'), 0),
    -- Possível venda: o valor das abertas sem parcela + o das parcelas canceladas.
    coalesce(sum(valor) filter (where status = 'open' and parcelas = 0), 0)
      + coalesce(sum(cancelado), 0),
    count(*) filter (where recebidas > 0)::integer,
    min(primeira),
    max(ultima)
    into v_ltv, v_prev, v_int, v_n, v_first, v_last
    from ops;

  update public.contacts
     set ltv_cents = v_ltv,
         ltv_forecast_cents = v_ltv + v_prev,
         interest_cents = v_int,
         sales_count = v_n,
         last_purchase_on = v_last,
         first_purchase_on = v_first
   where id = p_contact and organization_id = p_org;
end
$f$;

-- ── 6b. O resumo do contato acompanha a oportunidade (valor, situação, contato) ─
create or replace function public.fn_lead_refresh_contato()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if tg_op <> 'DELETE' and new.contact_id is not null then
    perform public.fn_crm_sales_refresh_contact(new.organization_id, new.contact_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.contact_id is not null
     and (tg_op = 'DELETE' or old.contact_id is distinct from new.contact_id) then
    perform public.fn_crm_sales_refresh_contact(old.organization_id, old.contact_id);
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_lead_refresh_contato() from public, anon, authenticated;

drop trigger if exists trg_lead_refresh_contato on public.crm_leads;
create trigger trg_lead_refresh_contato
  after insert or delete or update of value_cents, status, contact_id on public.crm_leads
  for each row execute function public.fn_lead_refresh_contato();

-- ── 7. Parcelas: o card e o contato acompanham ──────────────────────────────
create or replace function public.fn_crm_sale_payments_after_write()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
  v_ult date; v_contact uuid; v_org uuid;
begin
  if v_lead is null then
    return coalesce(new, old);
  end if;
  select max(paid_on) filter (where status = 'recebida') into v_ult
    from public.crm_sale_payments where lead_id = v_lead;
  select contact_id, organization_id into v_contact, v_org from public.crm_leads where id = v_lead;
  if not found then
    return coalesce(new, old);
  end if;
  update public.crm_leads set paid_on = v_ult where id = v_lead and paid_on is distinct from v_ult;
  -- A primeira parcela recebida (mesmo um sinal) faz a oportunidade virar Comprou.
  if tg_op <> 'DELETE' and new.status = 'recebida' then
    update public.crm_leads l
       set stage_id = w.id
      from (
        select st.id, st.pipeline_id from public.crm_stages st
         where st.is_won and not st.is_archived
         order by st.position
      ) w
     where l.id = v_lead and l.status = 'open' and w.pipeline_id = l.pipeline_id;
  end if;
  if v_contact is not null then
    perform public.fn_crm_sales_refresh_contact(v_org, v_contact);
    perform public.fn_contato_recalcula_ciclo(v_org, v_contact);
  end if;
  return coalesce(new, old);
end
$f$;

create or replace function public.fn_crm_payment_deleted_refresh()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  return old;
end
$f$;

create or replace function public.fn_lead_atualiza_com_pagamento(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $f$
begin
  if p_lead is null then return; end if;
  update public.crm_leads l
     set com_pagamento = exists (
           select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida'
         )
   where l.id = p_lead
     and l.com_pagamento is distinct from exists (
           select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida'
         );
end
$f$;

create or replace function public.fn_com_pagamento_apos_parcela()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  perform public.fn_lead_atualiza_com_pagamento(coalesce(new.lead_id, old.lead_id));
  return null;
end
$f$;

create or replace function public.fn_historico_status_do_pagamento()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_contact uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select contact_id into v_contact from public.crm_leads where id = new.lead_id;
  insert into public.crm_historico_de_estados
    (organization_id, entidade, entidade_id, contact_id, de, para, autor, autor_tipo)
  values
    (new.organization_id, 'pagamento', new.id, v_contact,
     case when tg_op = 'UPDATE' then old.status end, new.status,
     auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
  return new;
end
$f$;

create or replace function public.fn_crm_payment_forma_padrao()
returns trigger language plpgsql as $f$
begin
  if new.forma is null then
    select nullif(payment_method, '') into new.forma from public.crm_leads where id = new.lead_id;
  end if;
  return new;
end
$f$;

-- ── 8. Campanha com ticket: a oportunidade nasce com os produtos e o valor ──
create or replace function public.fn_lead_interest_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_c record; v_ids uuid[]; v_n integer; v_parte bigint; v_resto bigint; v_i integer := 0;
  v_pid uuid; v_nome text;
begin
  if new.demand_campaign_id is null or new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.demand_campaign_id is not distinct from new.demand_campaign_id then
    return new;
  end if;
  select c.id, c.product_id, c.product_ids, c.ticket_cents into v_c
    from public.demand_campaigns c
   where c.id = new.demand_campaign_id and c.organization_id = new.organization_id;
  if not found or coalesce(v_c.ticket_cents, 0) <= 0 then
    return new;
  end if;
  v_ids := case
    when cardinality(v_c.product_ids) > 0 then v_c.product_ids
    when v_c.product_id is not null then array[v_c.product_id]
    else '{}'::uuid[]
  end;
  v_n := cardinality(v_ids);
  if v_n = 0 then return new; end if;
  if exists (select 1 from public.crm_sale_items i where i.lead_id = new.id) then
    return new;
  end if;
  perform set_config('m1.valor_sync', 'on', true);
  v_parte := v_c.ticket_cents / v_n;
  v_resto := v_c.ticket_cents - v_parte * v_n;
  foreach v_pid in array v_ids loop
    select coalesce(nullif(p.title, ''), 'Produto') into v_nome
      from public.marketing_pages p where p.id = v_pid;
    insert into public.crm_sale_items
      (organization_id, lead_id, product_id, product_name, amount_cents, position)
    values
      (new.organization_id, new.id, v_pid, coalesce(v_nome, 'Produto'),
       v_parte + case when v_i = 0 then v_resto else 0 end, v_i);
    v_i := v_i + 1;
  end loop;
  update public.crm_leads set value_cents = v_c.ticket_cents where id = new.id;
  perform set_config('m1.valor_sync', 'off', true);
  return new;
end
$f$;

-- ── 9. Comprou só com pagamento recebido ────────────────────────────────────
create or replace function public.fn_crm_lead_close_on_stage() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_is_won  boolean;
  v_is_lost boolean;
  v_qual    text;
begin
  if tg_op = 'UPDATE'
     and new.stage_id is not distinct from old.stage_id
     and new.status   is not distinct from old.status then
    return new;
  end if;

  select is_won, is_lost, qualification into v_is_won, v_is_lost, v_qual
    from public.crm_stages where id = new.stage_id;

  if v_is_won then
    if (tg_op = 'INSERT' or old.status is distinct from 'won')
       and not exists (
         select 1 from public.crm_sale_payments p where p.lead_id = new.id and p.status = 'recebida'
       ) then
      raise exception 'comprou_exige_pagamento' using errcode = '22023',
        hint = 'Registre ao menos um pagamento recebido (mesmo só o sinal) antes de mover para Comprou.';
    end if;
    new.status := 'won';
    new.closed_at := coalesce(new.closed_at, now());
  elsif v_is_lost or v_qual = 'disqualified' then
    new.status := 'lost';
    new.closed_at := coalesce(new.closed_at, now());
    if tg_op = 'UPDATE' and old.status is distinct from 'lost' then
      new.lost_from_stage_id := coalesce(new.lost_from_stage_id, old.stage_id);
    end if;
  else
    if tg_op = 'UPDATE' and old.status in ('won','lost') then
      new.status := 'open';
      new.closed_at := null;
      new.lost_from_stage_id := null;
    end if;
  end if;
  return new;
end$$;

-- ── 10. O ciclo de vida, agora das oportunidades e parcelas ─────────────────
create or replace function public.fn_contato_recalcula_ciclo(p_org uuid, p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_padrao integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_abertas integer; v_valor bigint; v_proximo date;
  v_ops integer; v_desq integer;
  v_ja_pagou boolean; v_ativo boolean; v_assinatura boolean;
  v_anterior text; v_novo text; v_motivo text;
begin
  select coalesce(nullif(settings ->> 'janela_ativo_meses', '')::integer, 6)
    into v_padrao from public.organizations where id = p_org;
  v_padrao := least(60, greatest(1, coalesce(v_padrao, 6)));

  select ciclo_de_vida into v_anterior from public.contacts where id = p_contact and organization_id = p_org;

  with ops as (
    select l.id, l.status, l.value_cents, s.tipo,
           exists (
             select 1 from public.crm_sale_payments p
              where p.lead_id = l.id and p.status = 'recebida'
           ) as pago
      from public.crm_leads l
      left join public.crm_stages s on s.id = l.stage_id
     where l.organization_id = p_org and l.contact_id = p_contact
  )
  select
    count(*) filter (where (status = 'open' and coalesce(tipo, 'aberta') <> 'desqualificado')
                        or (status = 'won' and not pago)),
    coalesce(sum(value_cents) filter (where status = 'open' and coalesce(tipo, 'aberta') <> 'desqualificado'), 0),
    count(*),
    count(*) filter (where tipo = 'desqualificado')
    into v_abertas, v_valor, v_ops, v_desq
    from ops;

  select min(p.due_on) into v_proximo
    from public.crm_sale_payments p
    join public.crm_leads l on l.id = p.lead_id
   where l.organization_id = p_org and l.contact_id = p_contact
     and p.status = 'prevista' and l.status <> 'lost';

  with pagos as (
    select l.id as venda, coalesce(p.paid_on, l.paid_on) as quando,
           coalesce(
             (select max(c.janela_ativo_meses)
                from public.crm_sale_items i
                join public.marketing_pages c on c.id = i.product_id
               where i.lead_id = l.id),
             v_padrao) as janela
      from public.crm_leads l
      join public.crm_sale_payments p on p.lead_id = l.id and p.status = 'recebida'
     where l.organization_id = p_org and l.contact_id = p_contact
  )
  select count(*) > 0,
         coalesce(bool_or(quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date), false)
    into v_ja_pagou, v_ativo
    from pagos;

  select exists (
    select 1 from public.crm_leads l
     where l.organization_id = p_org and l.contact_id = p_contact
       and l.is_recurring and l.recurrence_active and l.status <> 'lost'
       and exists (select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida')
  ) into v_assinatura;

  if v_ativo or v_assinatura then
    v_novo := 'ativo';
    v_motivo := case when v_assinatura then 'Assinatura ativa' else 'Pagamento dentro da janela de cliente ativo' end;
  elsif v_ja_pagou then
    if v_abertas > 0 then
      v_novo := 'em_reativacao';
      v_motivo := 'Ex-cliente com nova oportunidade aberta';
    else
      v_novo := 'ex_cliente';
      v_motivo := 'Já pagou, mas está fora da janela de cliente ativo';
    end if;
  elsif v_abertas > 0 then
    v_novo := 'em_negociacao';
    v_motivo := 'Tem oportunidade aberta e ainda não pagou';
  elsif v_ops = 0 then
    v_novo := 'novo_lead';
    v_motivo := 'Entrou e ainda não tem oportunidade';
  elsif v_desq = v_ops then
    v_novo := 'desqualificado';
    v_motivo := 'Todas as oportunidades foram desqualificadas';
  else
    v_novo := 'nunca_comprou';
    v_motivo := 'Todas as oportunidades terminaram sem compra';
  end if;

  update public.contacts
     set ciclo_de_vida = v_novo,
         ciclo_motivo = v_motivo,
         oportunidades_abertas = v_abertas,
         valor_em_aberto_cents = v_valor,
         proximo_vencimento = v_proximo,
         ciclo_atualizado_em = case when v_anterior is distinct from v_novo then now() else ciclo_atualizado_em end
   where id = p_contact and organization_id = p_org
     and (ciclo_de_vida is distinct from v_novo
          or ciclo_motivo is distinct from v_motivo
          or oportunidades_abertas is distinct from v_abertas
          or valor_em_aberto_cents is distinct from v_valor
          or proximo_vencimento is distinct from v_proximo);

  if v_anterior is distinct from v_novo then
    insert into public.crm_historico_de_estados
      (organization_id, entidade, entidade_id, contact_id, de, para, motivo, autor, autor_tipo)
    values (p_org, 'pessoa', p_contact, p_contact, v_anterior, v_novo, v_motivo,
            auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
    if v_novo = 'ativo' and v_anterior in ('ex_cliente', 'em_reativacao') then
      perform public.fn_contato_soma_tag(p_contact, p_org, 'Reativado');
    end if;
  end if;
end
$$;

revoke all on function public.fn_contato_recalcula_ciclo(uuid, uuid) from public, anon, authenticated;

-- ── 11. A conferência passa a olhar só a oportunidade ───────────────────────
create or replace function public.fn_oportunidade_unica_divergencias()
returns table (tipo text, quantidade bigint)
language sql stable security definer set search_path = public as $f$
  select 'item_sem_lead_id'::text, count(*) from public.crm_sale_items where lead_id is null
  union all
  select 'parcela_sem_lead_id', count(*) from public.crm_sale_payments where lead_id is null
  union all
  select 'comprou_sem_pagamento', count(*) from public.crm_leads l
   join public.crm_stages s on s.id = l.stage_id
   where s.is_won and not exists (
     select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida'
   )
$f$;
revoke execute on function public.fn_oportunidade_unica_divergencias() from public, anon, authenticated;
grant execute on function public.fn_oportunidade_unica_divergencias() to service_role;

select public.fn_ciclo_recalcula_todos(null);

do $$
declare r record;
begin
  for r in select distinct organization_id, contact_id from public.crm_leads where contact_id is not null loop
    perform public.fn_crm_sales_refresh_contact(r.organization_id, r.contact_id);
  end loop;
end
$$;

notify pgrst, 'reload schema';

-- ── 12. Métricas e relatórios, das oportunidades e das parcelas ─────────────
create or replace function public.fn_vendas_por_produto(p_org uuid, p_from date, p_to date)
returns table(product_id uuid, nome text, vendas integer, interesse_cents bigint, recebido_cents bigint, a_receber_cents bigint)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  with itens as (
    select i.product_id, i.product_name, i.amount_cents as item_cents,
           l.id as lead_id, l.status, coalesce(l.value_cents, 0) as valor_cents,
           coalesce(l.closed_at::date, l.paid_on) as fechada_em
      from public.crm_sale_items i
      join public.crm_leads l on l.id = i.lead_id
     where i.organization_id = p_org and l.status <> 'lost'
  ),
  parcelas as (
    select p.lead_id,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida' and p.paid_on between p_from and p_to), 0) as recebido,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista' and p.due_on between p_from and p_to), 0) as previsto,
           bool_or(p.status = 'recebida') as paga
      from public.crm_sale_payments p
     where p.organization_id = p_org
     group by p.lead_id
  )
  select it.product_id,
         max(it.product_name) as nome,
         count(distinct it.lead_id) filter (
           where coalesce(pa.paga, false) and it.fechada_em between p_from and p_to
         )::integer as vendas,
         coalesce(sum(it.item_cents) filter (where not coalesce(pa.paga, false) and pa.lead_id is null), 0)::bigint as interesse_cents,
         coalesce(sum(case when it.valor_cents > 0
                           then pa.recebido * it.item_cents / it.valor_cents else 0 end), 0)::bigint as recebido_cents,
         coalesce(sum(case when it.valor_cents > 0
                           then pa.previsto * it.item_cents / it.valor_cents else 0 end), 0)::bigint as a_receber_cents
    from itens it
    left join parcelas pa on pa.lead_id = it.lead_id
   group by it.product_id;
$f$;

create or replace function public.fn_demand_campaigns_resultados(p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table(campaign_id uuid, investido numeric, leads integer, vendas integer, recebido bigint, a_receber bigint)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  select c.id,
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.campaign_id = c.id and d.day between p_from and p_to), 0),
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and (l.pipeline_id = c.pipeline_id or l.demand_campaign_id = c.id)
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
    coalesce((select count(*)::integer from public.crm_leads l
               where l.organization_id = p_org and l.demand_campaign_id = c.id and l.status <> 'lost'
                 and (select min(p.paid_on) from public.crm_sale_payments p
                       where p.lead_id = l.id and p.status = 'recebida') between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where l.demand_campaign_id = c.id and p.status = 'recebida'
                and l.status <> 'lost' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where l.demand_campaign_id = c.id and p.status = 'prevista'
                and l.status <> 'lost' and p.due_on between p_from and p_to), 0)
  from public.demand_campaigns c
  where c.organization_id = p_org;
$f$;

create or replace function public.fn_metricas_do_crm(p_org uuid, p_from date, p_to date, p_tz text default 'America/Sao_Paulo')
returns table(leads integer, vendas integer, recebido bigint, a_receber bigint, investido numeric)
language sql stable set search_path to 'public', 'pg_temp' as $f$
  select
    coalesce((select count(distinct coalesce(l.contact_id, l.id))::integer
                from public.crm_leads l
               where l.organization_id = p_org
                 and (l.created_at at time zone p_tz)::date between p_from and p_to), 0),
    coalesce((select count(*)::integer from public.crm_leads l
               where l.organization_id = p_org and l.status <> 'lost'
                 and (select min(p.paid_on) from public.crm_sale_payments p
                       where p.lead_id = l.id and p.status = 'recebida') between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where p.organization_id = p_org and p.status = 'recebida'
                and l.status <> 'lost' and p.paid_on between p_from and p_to), 0),
    coalesce((select sum(p.amount_cents)::bigint from public.crm_sale_payments p
               join public.crm_leads l on l.id = p.lead_id
              where p.organization_id = p_org and p.status = 'prevista'
                and l.status <> 'lost' and p.due_on between p_from and p_to), 0),
    coalesce((select sum(d.spend) from public.demand_campaign_days d
               where d.organization_id = p_org and d.day between p_from and p_to), 0);
$f$;

create or replace function public.fn_lead_valor_somado(p_lead uuid)
returns bigint language sql stable set search_path to 'public' as $f$
  select coalesce((select sum(amount_cents) from public.crm_sale_items where lead_id = p_lead), 0)::bigint
$f$;

notify pgrst, 'reload schema';
