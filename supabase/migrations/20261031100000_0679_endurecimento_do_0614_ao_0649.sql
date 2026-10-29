-- manifest: **Endurecimento do que as migrations 0614-0649 deixaram aberto.** `anon` perde o privilégio nas 7 tabelas novas; `fn_colegas_podem_ver_agenda` passa a conferir que quem chama é da organização; funções de gatilho e de restauração da lixeira perdem o EXECUTE de `authenticated`; 7 funções ganham `search_path` fixo; excluir uma organização com oportunidades deixa de falhar.
-- 1. `anon` fora das tabelas que as migrations 0614-0649 criaram. O default do Supabase concede tudo
--    a anon em toda tabela nova; a RLS já barra, mas privilégio que não se usa não se deixa de pé.
do $$
declare t text;
begin
  foreach t in array array[
    'ad_adsets', 'ad_insights_daily', 'calendar_event_type_attendants',
    'crm_historico_de_estados', 'crm_lixeira', 'crm_saved_view_arquivadas', 'payment_fee_settings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon', t);
    end if;
  end loop;
end $$;

-- 2. `fn_colegas_podem_ver_agenda(p_org)` é definer e lê `organizations` por id: quem chama tem de
--    ser membro da organização (a régua da 0149). Sem sessão (service role, cron) segue como antes.
create or replace function public.fn_colegas_podem_ver_agenda(p_org uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.fn_role_at_least(p_org, 'viewer') then
    raise exception 'caller_not_authorized_for_org' using errcode = '42501';
  end if;
  return coalesce(
    (select (o.settings->'colegas_podem_ver_agenda') is distinct from 'false'::jsonb
       from public.organizations o where o.id = p_org),
    true);
end;
$$;
revoke execute on function public.fn_colegas_podem_ver_agenda(uuid) from public, anon;
grant execute on function public.fn_colegas_podem_ver_agenda(uuid) to authenticated, service_role;

-- 3. Função de gatilho não precisa de EXECUTE para ninguém (o gatilho dispara com o dono da tabela), e
--    as de restauração da lixeira só são chamadas de dentro de outras funções definer.
revoke execute on function public.fn_contact_first_approach() from public, anon, authenticated;
revoke execute on function public.fn_contato_tag_mql() from public, anon, authenticated;
revoke execute on function public.fn_crm_tasks_historico() from public, anon, authenticated;
revoke execute on function public.fn_lead_ganhou_entra_no_funil() from public, anon, authenticated;
revoke execute on function public.fn_lead_tag_do_funil() from public, anon, authenticated;
revoke execute on function public.fn_lead_tags_de_origem() from public, anon, authenticated;
revoke execute on function public.fn_historico_apagar_do_contato(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_historico_inserir_da_lixeira(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_recalcula_cliente_restaurado(uuid, uuid) from public, anon, authenticated;

-- 4. `search_path` fixo nas funções que ficaram sem (o `create or replace` das migrations o apaga).
alter function public.fn_crm_payment_forma_padrao() set search_path = public;
alter function public.fn_crm_stages_fixa_nao_arquiva() set search_path = public;
alter function public.fn_crm_stages_tipo() set search_path = public;
alter function public.fn_crm_tasks_prazo_original() set search_path = public;
alter function public.fn_cronograma_mudar_prazo(uuid, timestamp with time zone, text) set search_path = public;
alter function public.fn_inicial_maiuscula(text) set search_path = public;
alter function public.fn_tag_canonica(text) set search_path = public;

-- 5. Excluir uma ORGANIZAÇÃO com oportunidades falhava (violação de FK em crm_historico_de_estados): o
--    recálculo do ciclo de vida, disparado pelo gatilho de cada oportunidade apagada em cascata, gravava
--    histórico para uma organização que já não existe.
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
  -- Apagar a ORGANIZAÇÃO apaga em cascata as oportunidades, e o gatilho de cada uma chega aqui com a
  -- organização já removida: gravar histórico apontando para ela viola a FK e a exclusão inteira falha.
  if not exists (select 1 from public.organizations where id = p_org) then
    return;
  end if;
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
