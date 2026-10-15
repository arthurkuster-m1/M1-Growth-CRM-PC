-- manifest: **Passo 3 do modelo CRM: Comprou / Não comprou / Desqualificado.** As etapas "Ganho" e "Perdido" dos funis passam a se chamar "Comprou" e "Não comprou" (só o nome; o slug e o comportamento ficam); entrar na etapa Desqualificado (papel `disqualified`) encerra o card como perdido (status lost, com motivo obrigatório e `lost_from_stage_id`), e a pessoa fica "Desqualificado" quando todas as oportunidades terminaram assim; as etapas fixas não podem ser arquivadas; todo funil novo já nasce com a etapa Desqualificado.

-- ── 1. Os nomes ─────────────────────────────────────────────────────────────
update public.crm_stages set name = 'Comprou' where is_won and name = 'Ganho';
update public.crm_stages set name = 'Não comprou' where is_lost and name = 'Perdido';

-- ── 2. Desqualificado encerra o card ────────────────────────────────────────
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
    new.status := 'won';
    new.closed_at := coalesce(new.closed_at, now());
  elsif v_is_lost or v_qual = 'disqualified' then
    -- "Desqualificado" é uma saída sem compra: fecha o card como perdido, com motivo.
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

revoke execute on function public.fn_crm_lead_close_on_stage() from public, anon;
grant execute on function public.fn_crm_lead_close_on_stage() to anon, authenticated, service_role;

-- ── 3. O ciclo: desqualificado conta pela etapa, não pelo status ────────────
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
    count(*) filter (where tipo = 'desqualificado')
    into v_abertas, v_valor, v_ops, v_desq
    from ops;

  select min(p.due_on) into v_proximo
    from public.crm_sale_payments p
    join public.crm_sales v on v.id = p.sale_id
   where v.organization_id = p_org and v.contact_id = p_contact
     and p.status = 'prevista' and v.status in ('comprometida', 'concluida');

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

-- ── 4. As etapas fixas não se arquivam ──────────────────────────────────────
create or replace function public.fn_crm_stages_fixa_nao_arquiva()
returns trigger language plpgsql as $f$
begin
  if old.fixa and new.is_archived and not old.is_archived then
    raise exception 'etapa_fixa_nao_arquiva' using errcode = '22023',
      hint = 'Comprou, Não comprou e Desqualificado são etapas fixas do funil.';
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_stages_fixa_nao_arquiva on public.crm_stages;
create trigger trg_crm_stages_fixa_nao_arquiva
  before update of is_archived on public.crm_stages
  for each row execute function public.fn_crm_stages_fixa_nao_arquiva();

-- ── 5. Funil novo já nasce com a etapa Desqualificado ───────────────────────
create or replace function public.fn_funil_novo_com_desqualificado()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  insert into public.crm_stages (organization_id, pipeline_id, name, slug, position, color, qualification)
  values (new.organization_id, new.id, 'Desqualificado', 'desqualificado', 5000, '#6b7280', 'disqualified')
  on conflict do nothing;
  return new;
end
$f$;
revoke execute on function public.fn_funil_novo_com_desqualificado() from public, anon, authenticated;

drop trigger if exists trg_funil_novo_com_desqualificado on public.crm_pipelines;
create trigger trg_funil_novo_com_desqualificado
  after insert on public.crm_pipelines
  for each row execute function public.fn_funil_novo_com_desqualificado();

select public.fn_ciclo_recalcula_todos(null);

notify pgrst, 'reload schema';
