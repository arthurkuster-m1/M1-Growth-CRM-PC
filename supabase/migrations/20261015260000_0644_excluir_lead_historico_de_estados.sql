-- manifest: **Excluir lead volta a funcionar (permission denied em crm_historico_de_estados).** A exclusão do cliente (e a restauração da lixeira) rodam com a permissão de quem chama, e o histórico de estados é só-leitura para o usuário: apagar/recolocar essas linhas falhava e nada era excluído. Três funções pequenas e fechadas (security definer, só da própria empresa de quem chama) passam a apagar e recolocar SÓ o histórico daquele cliente e recalcular o resumo dele depois de restaurar. Conversas e mensagens do Inbox já saem junto com o lead (e vão para a lixeira de 7 dias); quem volta a falar entra como lead novo, com cadastro limpo.

-- ── 1. Só o histórico do cliente, só da empresa de quem chama ──────────────
create or replace function public.fn_historico_apagar_do_contato(
  p_organization_id uuid, p_contact_id uuid
) returns void language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if p_organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  delete from public.crm_historico_de_estados
   where organization_id = p_organization_id and contact_id = p_contact_id;
end
$f$;
revoke execute on function public.fn_historico_apagar_do_contato(uuid, uuid) from public, anon;
grant execute on function public.fn_historico_apagar_do_contato(uuid, uuid) to authenticated, service_role;

create or replace function public.fn_historico_inserir_da_lixeira(
  p_organization_id uuid, p_linha jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if p_organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  -- Só linhas da própria empresa (a cópia da lixeira é da empresa de quem chama).
  if (p_linha ->> 'organization_id')::uuid is distinct from p_organization_id then
    raise exception 'linha de outra empresa' using errcode = '42501';
  end if;
  perform public.fn_inserir_da_lixeira('public.crm_historico_de_estados', p_linha);
end
$f$;
revoke execute on function public.fn_historico_inserir_da_lixeira(uuid, jsonb) from public, anon;
grant execute on function public.fn_historico_inserir_da_lixeira(uuid, jsonb) to authenticated, service_role;

create or replace function public.fn_recalcula_cliente_restaurado(
  p_organization_id uuid, p_contact_id uuid
) returns void language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if p_organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  perform public.fn_crm_sales_refresh_contact(p_organization_id, p_contact_id);
  perform public.fn_contato_recalcula_ciclo(p_organization_id, p_contact_id);
end
$f$;
revoke execute on function public.fn_recalcula_cliente_restaurado(uuid, uuid) from public, anon;
grant execute on function public.fn_recalcula_cliente_restaurado(uuid, uuid) to authenticated, service_role;

-- ── 2. Excluir e restaurar passam pelas funções acima ──────────────────────
create or replace function public.fn_excluir_cliente_para_lixeira(
  p_contact_id uuid, p_organization_id uuid
) returns boolean language plpgsql set search_path = public, pg_temp as $f$
declare
  v_contato jsonb;
  v_leads uuid[];
  v_snap jsonb;
  v_nome text;
  v_ltv bigint;
begin
  select to_jsonb(c), coalesce(nullif(btrim(c.display_name), ''), nullif(btrim(c.name), ''), c.phone_number, '—'),
         coalesce(c.ltv_cents, 0)
    into v_contato, v_nome, v_ltv
    from public.contacts c
   where c.id = p_contact_id and c.organization_id = p_organization_id;
  if v_contato is null then
    return false;
  end if;

  select coalesce(array_agg(id), '{}') into v_leads
    from public.crm_leads where contact_id = p_contact_id and organization_id = p_organization_id;

  v_snap := jsonb_build_object(
    'contato', v_contato,
    'oportunidades', coalesce((select jsonb_agg(to_jsonb(l)) from public.crm_leads l where l.id = any (v_leads)), '[]'),
    'itens', coalesce((select jsonb_agg(to_jsonb(i)) from public.crm_sale_items i where i.lead_id = any (v_leads)), '[]'),
    'parcelas', coalesce((select jsonb_agg(to_jsonb(p)) from public.crm_sale_payments p where p.lead_id = any (v_leads)), '[]'),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_tasks t
                          where t.organization_id = p_organization_id
                            and (t.contact_id = p_contact_id or t.lead_id = any (v_leads))), '[]'),
    'notas', coalesce((select jsonb_agg(to_jsonb(n)) from public.lead_notes n where n.contact_id = p_contact_id), '[]'),
    'atividades', coalesce((select jsonb_agg(to_jsonb(a)) from public.crm_lead_activities a
                              where a.organization_id = p_organization_id
                                and (a.contact_id = p_contact_id or a.lead_id = any (v_leads))), '[]'),
    'conversas', coalesce((select jsonb_agg(to_jsonb(cv)) from public.conversations cv
                             where cv.contact_id = p_contact_id and cv.organization_id = p_organization_id), '[]'),
    'mensagens', coalesce((select jsonb_agg(to_jsonb(m)) from public.messages m
                             where m.contact_id = p_contact_id and m.organization_id = p_organization_id), '[]'),
    'compromissos', coalesce((select jsonb_agg(to_jsonb(ap)) from public.calendar_appointments ap
                                where ap.contact_id = p_contact_id and ap.organization_id = p_organization_id), '[]'),
    'historico', coalesce((select jsonb_agg(to_jsonb(h)) from public.crm_historico_de_estados h
                             where h.contact_id = p_contact_id and h.organization_id = p_organization_id), '[]')
  );

  insert into public.crm_lixeira
    (organization_id, contact_id, nome, telefone, email, resumo, snapshot, excluido_por)
  values (
    p_organization_id, p_contact_id, v_nome,
    v_contato ->> 'phone_number', v_contato ->> 'email',
    jsonb_build_object(
      'oportunidades', coalesce(array_length(v_leads, 1), 0),
      'parcelas', jsonb_array_length(v_snap -> 'parcelas'),
      'pago_cents', v_ltv,
      'mensagens', jsonb_array_length(v_snap -> 'mensagens')
    ),
    v_snap, auth.uid()
  );

  -- Tudo que depende do cliente sai junto (mesmo com venda paga).
  delete from public.messages where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.conversations where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.calendar_appointments where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.crm_tasks
   where organization_id = p_organization_id
     and (contact_id = p_contact_id or lead_id = any (v_leads));
  delete from public.crm_lead_activities
   where organization_id = p_organization_id
     and (contact_id = p_contact_id or lead_id = any (v_leads));
  perform public.fn_historico_apagar_do_contato(p_organization_id, p_contact_id);
  delete from public.crm_leads
   where organization_id = p_organization_id and contact_id = p_contact_id;
  delete from public.contacts
   where id = p_contact_id and organization_id = p_organization_id;
  return found;
end
$f$;

create or replace function public.fn_restaurar_cliente_da_lixeira(
  p_item uuid, p_organization_id uuid
) returns uuid language plpgsql set search_path = public, pg_temp as $f$
declare
  v_item public.crm_lixeira%rowtype;
  v_snap jsonb;
  v_linha jsonb;
  v_contact uuid;
begin
  select * into v_item from public.crm_lixeira
   where id = p_item and organization_id = p_organization_id;
  if not found then
    return null;
  end if;
  v_snap := v_item.snapshot;
  v_contact := v_item.contact_id;

  -- Restaurar não dispara evento nem rotina: o que volta é o que existia.
  perform set_config('m1.restaurando', 'on', true);
  perform set_config('m1.valor_sync', 'on', true);

  perform public.fn_inserir_da_lixeira('public.contacts', v_snap -> 'contato');
  for v_linha in select * from jsonb_array_elements(v_snap -> 'conversas') loop
    perform public.fn_inserir_da_lixeira('public.conversations', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'oportunidades') loop
    perform public.fn_inserir_da_lixeira('public.crm_leads', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'itens') loop
    perform public.fn_inserir_da_lixeira('public.crm_sale_items', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'parcelas') loop
    perform public.fn_inserir_da_lixeira('public.crm_sale_payments', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'mensagens') loop
    perform public.fn_inserir_da_lixeira('public.messages', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'compromissos') loop
    perform public.fn_inserir_da_lixeira('public.calendar_appointments', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'tarefas') loop
    perform public.fn_inserir_da_lixeira('public.crm_tasks', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'notas') loop
    perform public.fn_inserir_da_lixeira('public.lead_notes', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'atividades') loop
    perform public.fn_inserir_da_lixeira('public.crm_lead_activities', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'historico') loop
    perform public.fn_historico_inserir_da_lixeira(p_organization_id, v_linha);
  end loop;

  perform set_config('m1.valor_sync', 'off', true);
  perform set_config('m1.restaurando', 'off', true);

  -- O resumo e o ciclo de vida voltam calculados do que acabou de voltar.
  perform public.fn_recalcula_cliente_restaurado(p_organization_id, v_contact);

  delete from public.crm_lixeira where id = p_item;
  return v_contact;
end
$f$;

-- ── 3. Restaurar não duplica o histórico (ele volta da cópia, não do gatilho) ──
create or replace function public.fn_historico_etapa_da_oportunidade() returns trigger
  language plpgsql security definer set search_path to 'public' as $f$
declare
  v_de text;
  v_para text;
begin
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    select name into v_de from public.crm_stages where id = old.stage_id;
  end if;
  select name into v_para from public.crm_stages where id = new.stage_id;
  insert into public.crm_historico_de_estados
    (organization_id, entidade, entidade_id, contact_id, de, para, motivo, autor, autor_tipo)
  values
    (new.organization_id, 'oportunidade', new.id, new.contact_id, v_de, coalesce(v_para, '—'),
     case when new.status = 'lost' then new.lost_reason when new.status = 'won' then new.won_reason end,
     auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
  return new;
end
$f$;

create or replace function public.fn_historico_status_do_pagamento() returns trigger
  language plpgsql security definer set search_path to 'public' as $f$
declare
  v_contact uuid;
begin
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return new;
  end if;
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
