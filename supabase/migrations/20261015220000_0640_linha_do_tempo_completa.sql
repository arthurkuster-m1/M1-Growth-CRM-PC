-- manifest: **A linha do tempo registra tudo do lead, das oportunidades e das vendas.** Parcela comprometida, recebida, cancelada, com vencimento ou valor alterado e atrasada, a primeira compra que leva a oportunidade a Comprou e a mudança de ciclo de vida do cliente passam a entrar em `crm_lead_activities` (tipos `payment_committed`, `payment_received`, `payment_cancelled`, `payment_rescheduled`, `payment_value_changed`, `payment_overdue`, `lifecycle_changed`); `fn_registrar_parcelas_atrasadas` (rotina diária) marca cada parcela vencida uma vez.

-- ── 1. Parcela → linha do tempo ─────────────────────────────────────────────
create or replace function public.fn_parcela_na_linha_do_tempo()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_lead record;
  v_tipo text;
  v_razao text;
  v_extra jsonb := '{}'::jsonb;
begin
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return null;
  end if;
  select l.id, l.contact_id, l.organization_id into v_lead
    from public.crm_leads l where l.id = new.lead_id;
  if not found then return null; end if;

  if tg_op = 'INSERT' then
    v_tipo := case new.status when 'recebida' then 'payment_received'
                              when 'cancelada' then null
                              else 'payment_committed' end;
  else
    if new.status is distinct from old.status then
      v_tipo := case new.status when 'recebida' then 'payment_received'
                                when 'cancelada' then 'payment_cancelled'
                                else 'payment_committed' end;
    elsif new.due_on is distinct from old.due_on and new.status = 'prevista' then
      v_tipo := 'payment_rescheduled';
      v_extra := jsonb_build_object('de', old.due_on, 'para', new.due_on);
    elsif new.amount_cents is distinct from old.amount_cents then
      v_tipo := 'payment_value_changed';
      v_extra := jsonb_build_object('de_cents', old.amount_cents, 'para_cents', new.amount_cents);
    end if;
  end if;
  if v_tipo is null then return null; end if;

  v_razao := 'Parcela ' || new.number || ' · R$ '
          || replace(to_char(new.amount_cents / 100.0, 'FM999G999G990D00'), ',', 'X')
          || ' · vence ' || to_char(new.due_on, 'DD/MM/YYYY');
  v_razao := replace(replace(replace(v_razao, '.', ','), 'X', '.'), ',', ',');

  insert into public.crm_lead_activities
    (organization_id, lead_id, contact_id, source_module, source_id, type, payload, reason,
     performed_by_user_id, actor_kind)
  values
    (v_lead.organization_id, v_lead.id, v_lead.contact_id, 'vendas', new.id, v_tipo,
     jsonb_build_object('payment_id', new.id, 'number', new.number, 'amount_cents', new.amount_cents,
                        'due_on', new.due_on, 'paid_on', new.paid_on, 'forma', new.forma) || v_extra,
     v_razao, auth.uid(), case when auth.uid() is null then 'system' else 'user' end);
  return null;
end
$f$;
revoke execute on function public.fn_parcela_na_linha_do_tempo() from public, anon, authenticated;

drop trigger if exists trg_parcela_na_linha_do_tempo on public.crm_sale_payments;
create trigger trg_parcela_na_linha_do_tempo
  after insert or update of status, due_on, amount_cents on public.crm_sale_payments
  for each row execute function public.fn_parcela_na_linha_do_tempo();

-- ── 2. A oportunidade que virou Comprou pelo pagamento também entra na linha do tempo ──
create or replace function public.fn_parcela_leva_a_comprou()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_lead record;
begin
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return null;
  end if;
  if new.stage_id is not distinct from old.stage_id then return null; end if;
  -- Quem move pelo quadro ou pela lista já registra a própria linha; aqui só o que o banco fez.
  if coalesce(current_setting('m1.comprou_pelo_pagamento', true), '') <> 'on' then return null; end if;
  insert into public.crm_lead_activities
    (organization_id, lead_id, contact_id, source_module, type, payload, reason, actor_kind)
  select new.organization_id, new.id, new.contact_id, 'vendas', 'stage_changed',
         jsonb_build_object('de_stage_id', old.stage_id, 'para_stage_id', new.stage_id),
         'Primeiro pagamento recebido: virou Comprou', 'system';
  return null;
end
$f$;
revoke execute on function public.fn_parcela_leva_a_comprou() from public, anon, authenticated;

drop trigger if exists trg_parcela_leva_a_comprou on public.crm_leads;
create trigger trg_parcela_leva_a_comprou
  after update of stage_id on public.crm_leads
  for each row execute function public.fn_parcela_leva_a_comprou();

-- O sinaliza-dor: a função que move a oportunidade pelo pagamento liga a marca só nesse update.
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
    perform set_config('m1.comprou_pelo_pagamento', 'on', true);
    update public.crm_leads l
       set stage_id = w.id
      from (
        select st.id, st.pipeline_id from public.crm_stages st
         where st.is_won and not st.is_archived
         order by st.position
      ) w
     where l.id = v_lead and l.status = 'open' and w.pipeline_id = l.pipeline_id;
    perform set_config('m1.comprou_pelo_pagamento', 'off', true);
  end if;
  if v_contact is not null then
    perform public.fn_crm_sales_refresh_contact(v_org, v_contact);
    perform public.fn_contato_recalcula_ciclo(v_org, v_contact);
  end if;
  return coalesce(new, old);
end
$f$;

-- ── 3. Mudança de ciclo de vida na linha do tempo ──────────────────────────
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
  v_ativo_ate date;
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
         coalesce(bool_or(quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date), false),
         max((quando + (janela || ' months')::interval)::date)
           filter (where quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date)
    into v_ja_pagou, v_ativo, v_ativo_ate
    from pagos;

  select exists (
    select 1 from public.crm_leads l
     where l.organization_id = p_org and l.contact_id = p_contact
       and l.is_recurring and l.recurrence_active and l.status <> 'lost'
       and exists (select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida')
  ) into v_assinatura;

  if v_ativo or v_assinatura then
    v_novo := 'ativo';
    v_motivo := case
      when v_assinatura then 'Assinatura ativa'
      else 'Pagou dentro da janela de cliente ativo, até ' || to_char(v_ativo_ate, 'DD/MM/YYYY')
    end;
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
         ativo_ate = case when v_novo = 'ativo' and not v_assinatura then v_ativo_ate end,
         ciclo_atualizado_em = case when v_anterior is distinct from v_novo then now() else ciclo_atualizado_em end
   where id = p_contact and organization_id = p_org
     and (ciclo_de_vida is distinct from v_novo
          or ciclo_motivo is distinct from v_motivo
          or oportunidades_abertas is distinct from v_abertas
          or valor_em_aberto_cents is distinct from v_valor
          or proximo_vencimento is distinct from v_proximo
          or ativo_ate is distinct from case when v_novo = 'ativo' and not v_assinatura then v_ativo_ate end);

  if v_anterior is distinct from v_novo then
    insert into public.crm_historico_de_estados
      (organization_id, entidade, entidade_id, contact_id, de, para, motivo, autor, autor_tipo)
    values (p_org, 'pessoa', p_contact, p_contact, v_anterior, v_novo, v_motivo,
            auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
    -- A mudança de ciclo também entra na linha do tempo (no negócio mais recente da pessoa).
    if v_anterior is not null and coalesce(current_setting('m1.restaurando', true), '') <> 'on' then
      insert into public.crm_lead_activities
        (organization_id, lead_id, contact_id, source_module, type, payload, reason,
         performed_by_user_id, actor_kind)
      select p_org, l.id, p_contact, 'vendas', 'lifecycle_changed',
             jsonb_build_object('de', v_anterior, 'para', v_novo),
             v_motivo, auth.uid(), case when auth.uid() is null then 'system' else 'user' end
        from public.crm_leads l
       where l.organization_id = p_org and l.contact_id = p_contact
       order by l.created_at desc limit 1;
    end if;
    if v_novo = 'ativo' and v_anterior in ('ex_cliente', 'em_reativacao') then
      perform public.fn_contato_soma_tag(p_contact, p_org, 'Reativado');
    end if;
  end if;
end
$$;

revoke all on function public.fn_contato_recalcula_ciclo(uuid, uuid) from public, anon, authenticated;

-- ── 4. Parcela atrasada: uma vez por parcela (a rotina diária chama) ───────
create or replace function public.fn_registrar_parcelas_atrasadas()
returns integer language plpgsql security definer set search_path = public as $f$
declare
  n integer;
begin
  insert into public.crm_lead_activities
    (organization_id, lead_id, contact_id, source_module, source_id, type, payload, reason, actor_kind)
  select p.organization_id, l.id, l.contact_id, 'vendas', p.id, 'payment_overdue',
         jsonb_build_object('payment_id', p.id, 'number', p.number, 'amount_cents', p.amount_cents,
                            'due_on', p.due_on),
         'Parcela ' || p.number || ' venceu em ' || to_char(p.due_on, 'DD/MM/YYYY') || ' e não foi paga',
         'system'
    from public.crm_sale_payments p
    join public.crm_leads l on l.id = p.lead_id
   where p.status = 'prevista'
     and p.due_on < (now() at time zone 'America/Sao_Paulo')::date
     and l.status <> 'lost'
     and not exists (
       select 1 from public.crm_lead_activities a
        where a.lead_id = l.id and a.type = 'payment_overdue' and a.source_id = p.id
     );
  get diagnostics n = row_count;
  return n;
end
$f$;
revoke execute on function public.fn_registrar_parcelas_atrasadas() from public, anon, authenticated;
grant execute on function public.fn_registrar_parcelas_atrasadas() to service_role;

notify pgrst, 'reload schema';
