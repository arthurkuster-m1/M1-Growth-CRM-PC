-- manifest: **Passo 2 do modelo CRM: ciclo de vida da pessoa.** `contacts.ciclo_de_vida` (novo_lead | em_negociacao | ativo | ex_cliente | em_reativacao | nunca_comprou | desqualificado) calculado das oportunidades e das parcelas pagas, com `ciclo_motivo`, `oportunidades_abertas`, `valor_em_aberto_cents`, `proximo_vencimento` e `dono_user_id` (dono da pessoa); janela de "ativo" por produto (`marketing_pages.janela_ativo_meses` (o produto)) com padrão da empresa em `organizations.settings.janela_ativo_meses` (6 meses); tag automática "Reativado" quando ex-cliente/em reativação volta a ser ativo; mudanças de ciclo vão para `crm_historico_de_estados`; recálculo por trigger e função para a rotina diária.

-- ── 1. Colunas ──────────────────────────────────────────────────────────────
alter table public.contacts
  add column if not exists ciclo_de_vida text,
  add column if not exists ciclo_motivo text,
  add column if not exists ciclo_atualizado_em timestamptz,
  add column if not exists oportunidades_abertas integer not null default 0,
  add column if not exists valor_em_aberto_cents bigint not null default 0,
  add column if not exists proximo_vencimento date,
  add column if not exists dono_user_id uuid references auth.users(id) on delete set null;

alter table public.contacts drop constraint if exists contacts_ciclo_de_vida_check;
alter table public.contacts add constraint contacts_ciclo_de_vida_check
  check (ciclo_de_vida is null or ciclo_de_vida in
    ('novo_lead', 'em_negociacao', 'ativo', 'ex_cliente', 'em_reativacao', 'nunca_comprou', 'desqualificado'));

create index if not exists contacts_ciclo_idx on public.contacts (organization_id, ciclo_de_vida);

alter table public.marketing_pages
  add column if not exists janela_ativo_meses smallint;
alter table public.marketing_pages drop constraint if exists marketing_pages_janela_ativo_check;
alter table public.marketing_pages add constraint marketing_pages_janela_ativo_check
  check (janela_ativo_meses is null or janela_ativo_meses between 1 and 60);

comment on column public.contacts.ciclo_de_vida is
  'Ciclo de vida calculado (nunca digitado): novo_lead, em_negociacao, ativo, ex_cliente, em_reativacao, nunca_comprou, desqualificado.';
comment on column public.marketing_pages.janela_ativo_meses is
  'Meses em que um pagamento deste produto mantém a pessoa como cliente ativa. Nulo = padrão da empresa.';

-- ── 2. O cálculo ────────────────────────────────────────────────────────────
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

  -- Oportunidades (cards).
  with ops as (
    select l.id, l.status, l.value_cents, s.tipo,
           exists (
             select 1 from public.crm_sales v
               join public.crm_sale_payments p on p.sale_id = v.id and p.status = 'recebida'
              where v.lead_id = l.id
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
    count(*) filter (where status = 'open' and tipo = 'desqualificado')
    into v_abertas, v_valor, v_ops, v_desq
    from ops;

  select min(p.due_on) into v_proximo
    from public.crm_sale_payments p
    join public.crm_sales v on v.id = p.sale_id
   where v.organization_id = p_org and v.contact_id = p_contact
     and p.status = 'prevista' and v.status in ('comprometida', 'concluida');

  -- Pagamentos recebidos e a janela do produto (a maior entre os itens; senão, o padrão).
  with pagos as (
    select v.id as venda, coalesce(p.paid_on, v.paid_on) as quando,
           coalesce(
             (select max(c.janela_ativo_meses)
                from public.crm_sale_items i
                join public.marketing_pages c on c.id = i.product_id
               where i.sale_id = v.id),
             v_padrao) as janela
      from public.crm_sales v
      join public.crm_sale_payments p on p.sale_id = v.id and p.status = 'recebida'
     where v.organization_id = p_org and v.contact_id = p_contact
       and v.status in ('comprometida', 'concluida')
    union all
    select v.id, v.paid_on,
           coalesce(
             (select max(c.janela_ativo_meses)
                from public.crm_sale_items i
                join public.marketing_pages c on c.id = i.product_id
               where i.sale_id = v.id),
             v_padrao)
      from public.crm_sales v
     where v.organization_id = p_org and v.contact_id = p_contact
       and v.status = 'concluida' and v.paid_on is not null
       and not exists (select 1 from public.crm_sale_payments p where p.sale_id = v.id and p.status <> 'cancelada')
  )
  select count(*) > 0,
         coalesce(bool_or(quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date), false)
    into v_ja_pagou, v_ativo
    from pagos;

  select exists (
    select 1 from public.crm_sales v
     where v.organization_id = p_org and v.contact_id = p_contact
       and v.is_recurring and v.recurrence_active and v.status in ('comprometida', 'concluida')
       and exists (select 1 from public.crm_sale_payments p where p.sale_id = v.id and p.status = 'recebida')
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

-- Todos os contatos de uma empresa (ou de todas, com null): rotina diária e mudança de janela.
create or replace function public.fn_ciclo_recalcula_todos(p_org uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; n integer := 0;
begin
  for r in
    select c.organization_id, c.id from public.contacts c
     where (p_org is null or c.organization_id = p_org)
       and not c.is_anonymized and c.is_merged_into is null
  loop
    perform public.fn_contato_recalcula_ciclo(r.organization_id, r.id);
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke all on function public.fn_ciclo_recalcula_todos(uuid) from public, anon, authenticated;
grant execute on function public.fn_ciclo_recalcula_todos(uuid) to service_role;

-- ── 3. Gatilhos ─────────────────────────────────────────────────────────────
create or replace function public.fn_ciclo_apos_contato()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  perform public.fn_contato_recalcula_ciclo(new.organization_id, new.id);
  return null;
end
$f$;
revoke execute on function public.fn_ciclo_apos_contato() from public, anon, authenticated;

-- Pagamentos e vendas já atualizam o resumo do contato; o ciclo vai junto.
drop trigger if exists trg_ciclo_apos_resumo on public.contacts;
create trigger trg_ciclo_apos_resumo
  after update of ltv_cents, ltv_forecast_cents, last_purchase_on, sales_count, interest_cents on public.contacts
  for each row execute function public.fn_ciclo_apos_contato();

drop trigger if exists trg_ciclo_contato_novo on public.contacts;
create trigger trg_ciclo_contato_novo
  after insert on public.contacts
  for each row execute function public.fn_ciclo_apos_contato();

create or replace function public.fn_ciclo_apos_oportunidade()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if tg_op <> 'DELETE' and new.contact_id is not null then
    perform public.fn_contato_recalcula_ciclo(new.organization_id, new.contact_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.contact_id is not null
     and (tg_op = 'DELETE' or old.contact_id is distinct from new.contact_id) then
    perform public.fn_contato_recalcula_ciclo(old.organization_id, old.contact_id);
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_ciclo_apos_oportunidade() from public, anon, authenticated;

drop trigger if exists trg_ciclo_apos_oportunidade on public.crm_leads;
create trigger trg_ciclo_apos_oportunidade
  after insert or delete or update of stage_id, status, contact_id, value_cents on public.crm_leads
  for each row execute function public.fn_ciclo_apos_oportunidade();

create or replace function public.fn_ciclo_apos_venda()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.contact_id is not null then
    perform public.fn_contato_recalcula_ciclo(new.organization_id, new.contact_id);
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_ciclo_apos_venda() from public, anon, authenticated;

drop trigger if exists trg_ciclo_apos_venda on public.crm_sales;
create trigger trg_ciclo_apos_venda
  after insert or update of status, is_recurring, recurrence_active, paid_on on public.crm_sales
  for each row execute function public.fn_ciclo_apos_venda();

-- Mudou a janela de um produto: a empresa toda é recalculada.
create or replace function public.fn_ciclo_apos_janela()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  perform public.fn_ciclo_recalcula_todos(new.organization_id);
  return null;
end
$f$;
revoke execute on function public.fn_ciclo_apos_janela() from public, anon, authenticated;

drop trigger if exists trg_ciclo_apos_janela on public.marketing_pages;
create trigger trg_ciclo_apos_janela
  after update of janela_ativo_meses on public.marketing_pages
  for each row when (old.janela_ativo_meses is distinct from new.janela_ativo_meses)
  execute function public.fn_ciclo_apos_janela();

-- ── 4. Dono da pessoa: começa pelo responsável da oportunidade mais recente ──
update public.contacts c
   set dono_user_id = x.owner_user_id
  from (
    select distinct on (l.contact_id) l.contact_id, l.owner_user_id
      from public.crm_leads l
     where l.owner_user_id is not null and l.owner_kind = 'user' and l.contact_id is not null
     order by l.contact_id, l.created_at desc
  ) x
 where x.contact_id = c.id and c.dono_user_id is null;

-- ── 5. O que já existe (sem tag "Reativado" retroativa: só nasce na volta) ──
select public.fn_ciclo_recalcula_todos(null);

notify pgrst, 'reload schema';
