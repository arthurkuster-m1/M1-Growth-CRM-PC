-- manifest: **Excluir e restaurar cliente voltam a funcionar para usuário logado (conflito 0644 × 0679).** A 0644 pôs `fn_excluir_cliente_para_lixeira` e `fn_restaurar_cliente_da_lixeira` como security invoker chamando três funções internas; a 0679 tirou o EXECUTE de `authenticated` dessas três assumindo que quem as chama roda como dono — e não roda: "permission denied for function fn_historico_apagar_do_contato" ao apagar e ao restaurar. As duas funções públicas passam a ser security definer, com a porta no começo (auth.uid(), empresa de quem chama, papel agent+ — o mesmo que as rotas exigem) e filtro de organization_id em tudo; a restauração também confere que todo o snapshot é da empresa de quem chama (a cópia da lixeira é gravável por quem tem papel, e agora a função não passa mais pela RLS). As três internas ficam SEM EXECUTE para public, anon e authenticated (reverte o GRANT à mão na VPS). Idempotente.

-- 0696 — LIXEIRA DE CLIENTES: EXCLUIR/RESTAURAR COMO DEFINER (conflito 0644 × 0679)
--
-- Por que quebrou: a 0644 criou três funções internas (security definer, EXECUTE para authenticated) e
-- fez `fn_excluir_cliente_para_lixeira` / `fn_restaurar_cliente_da_lixeira` (security INVOKER) chamá-las.
-- A 0679 fechou as três ("só são chamadas de dentro de outras funções definer"), mas as chamadoras NÃO
-- eram definer: o EXECUTE é checado com o papel de quem chama (`authenticated`), e o usuário logado
-- recebia 42501 ao apagar lead/cliente e ao restaurar da lixeira.
--
-- A correção definitiva NÃO reabre a porta da 0679: as internas seguem fechadas; quem passa a rodar
-- como dono são as DUAS funções públicas, que carregam a checagem de quem pode.

-- ── 1. Excluir cliente (vai para a lixeira) ────────────────────────────────
create or replace function public.fn_excluir_cliente_para_lixeira(
  p_contact_id uuid, p_organization_id uuid
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_contato jsonb;
  v_leads uuid[];
  v_snap jsonb;
  v_nome text;
  v_ltv bigint;
begin
  -- Roda como o dono (security definer): a porta é ESTA checagem, e vem antes de qualquer leitura.
  if auth.uid() is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_organization_id is null or p_organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not public.fn_role_at_least(p_organization_id, 'agent') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
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
    'oportunidades', coalesce((select jsonb_agg(to_jsonb(l)) from public.crm_leads l
                              where l.organization_id = p_organization_id and l.id = any (v_leads)), '[]'),
    'itens', coalesce((select jsonb_agg(to_jsonb(i)) from public.crm_sale_items i
                           where i.organization_id = p_organization_id and i.lead_id = any (v_leads)), '[]'),
    'parcelas', coalesce((select jsonb_agg(to_jsonb(p)) from public.crm_sale_payments p
                           where p.organization_id = p_organization_id and p.lead_id = any (v_leads)), '[]'),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_tasks t
                          where t.organization_id = p_organization_id
                            and (t.contact_id = p_contact_id or t.lead_id = any (v_leads))), '[]'),
    'notas', coalesce((select jsonb_agg(to_jsonb(n)) from public.lead_notes n
                           where n.organization_id = p_organization_id and n.contact_id = p_contact_id), '[]'),
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
  delete from public.crm_leads
   where organization_id = p_organization_id and contact_id = p_contact_id;
  -- O histórico sai DEPOIS das oportunidades: apagar uma oportunidade faz o gatilho recalcular o ciclo
  -- de vida e gravar uma linha nova no histórico do cliente ("em_negociacao → novo_lead"), que ficava
  -- órfã (sem contato) para sempre. Apagando por último, essa linha sai junto.
  perform public.fn_historico_apagar_do_contato(p_organization_id, p_contact_id);
  delete from public.contacts
   where id = p_contact_id and organization_id = p_organization_id;
  return found;
end
$f$;

-- ── 2. Restaurar cliente da lixeira ────────────────────────────────────────
create or replace function public.fn_restaurar_cliente_da_lixeira(
  p_item uuid, p_organization_id uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_item public.crm_lixeira%rowtype;
  v_snap jsonb;
  v_linha jsonb;
  v_contact uuid;
  v_novo uuid;
  v_c jsonb;
  v_existente uuid;
  v_mesclou boolean := false;
  v_secao text;
begin
  -- Roda como o dono (security definer): a porta é ESTA checagem, e vem antes de qualquer leitura.
  if auth.uid() is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_organization_id is null or p_organization_id not in (select public.fn_user_org_ids()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not public.fn_role_at_least(p_organization_id, 'agent') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select * into v_item from public.crm_lixeira
   where id = p_item and organization_id = p_organization_id;
  if not found then
    return null;
  end if;
  v_snap := v_item.snapshot;
  v_contact := v_item.contact_id;
  v_c := v_snap -> 'contato';

  -- A cópia da lixeira é gravável por quem tem papel (RLS de crm_lixeira) e esta função roda como o
  -- dono: sem esta conferência, um snapshot montado à mão poderia gravar linhas de OUTRA empresa.
  -- Toda linha do snapshot tem de ser da empresa de quem restaura.
  if (v_snap -> 'contato' ->> 'organization_id') is distinct from p_organization_id::text then
    raise exception 'snapshot de outra empresa' using errcode = '42501';
  end if;
  foreach v_secao in array array['conversas', 'oportunidades', 'itens', 'parcelas', 'mensagens',
                                 'compromissos', 'tarefas', 'notas', 'atividades', 'historico'] loop
    if exists (
      select 1 from jsonb_array_elements(coalesce(v_snap -> v_secao, '[]'::jsonb)) e
       where (e ->> 'organization_id') is distinct from p_organization_id::text
    ) then
      raise exception 'snapshot de outra empresa' using errcode = '42501';
    end if;
  end loop;


  -- O lead já voltou a falar e ganhou um cadastro novo (mesmo telefone, e-mail ou identidade)?
  -- Então o antigo é MESCLADO no novo, sem precisar apagar nada.
  select n.id into v_novo
    from public.contacts n
   where n.organization_id = p_organization_id
     and n.is_merged_into is null
     and n.id <> v_contact
     and (
       (nullif(v_c ->> 'phone_number', '') is not null and n.phone_number = v_c ->> 'phone_number')
       or (nullif(v_c ->> 'email_normalized', '') is not null and n.email_normalized = v_c ->> 'email_normalized')
       or (nullif(v_c ->> 'cpf_hash', '') is not null and n.cpf_hash = v_c ->> 'cpf_hash')
       or (nullif(v_c ->> 'wa_identity', '') is not null and n.wa_identity = v_c ->> 'wa_identity')
       or (nullif(v_c ->> 'wa_lid', '') is not null and n.wa_lid = v_c ->> 'wa_lid')
       or (nullif(v_c ->> 'social_identity', '') is not null and n.social_identity = v_c ->> 'social_identity')
     )
   order by n.created_at desc
   limit 1;

  if v_novo is not null then
    v_mesclou := true;
    -- Tudo que era do cliente antigo passa a ser do cadastro novo.
    v_snap := replace(v_snap::text, v_contact::text, v_novo::text)::jsonb;
    -- Conversa do mesmo canal que já existe no cadastro novo: as mensagens antigas entram nela.
    for v_linha in select * from jsonb_array_elements(v_snap -> 'conversas') loop
      select cv.id into v_existente
        from public.conversations cv
       where cv.organization_id = p_organization_id
         and cv.contact_id = v_novo
         and cv.channel_session_id is not distinct from nullif(v_linha ->> 'channel_session_id', '')::uuid
         and cv.is_group = coalesce((v_linha ->> 'is_group')::boolean, false)
         and cv.id <> (v_linha ->> 'id')::uuid
       limit 1;
      if v_existente is not null then
        v_snap := replace(v_snap::text, v_linha ->> 'id', v_existente::text)::jsonb;
      end if;
    end loop;
    v_contact := v_novo;
  end if;

  -- Restaurar não dispara evento nem rotina: o que volta é o que existia.
  perform set_config('m1.restaurando', 'on', true);
  perform set_config('m1.valor_sync', 'on', true);

  if v_mesclou then
    -- O cadastro mais antigo manda na origem e no nome; o novo mantém os canais e o que preencheu.
    update public.contacts n set
      tags = (select coalesce(array_agg(distinct x), '{}')
                from unnest(coalesce(n.tags, '{}') || coalesce(
                  array(select jsonb_array_elements_text(coalesce(v_c -> 'tags', '[]'::jsonb))), '{}')) as x),
      name = coalesce(nullif(btrim(v_c ->> 'name'), ''), n.name),
      display_name = coalesce(nullif(btrim(v_c ->> 'display_name'), ''), n.display_name),
      email = coalesce(n.email, nullif(v_c ->> 'email', '')),
      source = coalesce(nullif(v_c ->> 'source', ''), n.source),
      source_metadata = coalesce(v_c -> 'source_metadata', n.source_metadata),
      custom_fields = coalesce(v_c -> 'custom_fields', '{}'::jsonb) || coalesce(n.custom_fields, '{}'::jsonb),
      created_at = least(n.created_at, coalesce((v_c ->> 'created_at')::timestamptz, n.created_at)),
      first_approached_at = least(n.first_approached_at, (v_c ->> 'first_approached_at')::timestamptz),
      is_mql = n.is_mql or coalesce((v_c ->> 'is_mql')::boolean, false),
      dono_user_id = coalesce(n.dono_user_id, nullif(v_c ->> 'dono_user_id', '')::uuid)
     where n.id = v_novo and n.organization_id = p_organization_id;
  else
    perform public.fn_inserir_da_lixeira('public.contacts', v_snap -> 'contato');
  end if;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'conversas') loop
    if not exists (select 1 from public.conversations
                    where id = (v_linha ->> 'id')::uuid and organization_id = p_organization_id) then
      perform public.fn_inserir_da_lixeira('public.conversations', v_linha);
    end if;
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

  -- Restauração simples (sem mesclar): o histórico que voltou é a cópia exata do que existia. Ao
  -- recolocar as peças uma a uma, o recálculo do ciclo de vida grava idas e vindas passageiras
  -- (ex.: em_negociacao → novo_lead → em_negociacao) que nunca aconteceram com o cliente — e o
  -- histórico dobrava a cada exclusão/restauração. Só as linhas que NÃO vieram da cópia saem.
  if not v_mesclou then
    delete from public.crm_historico_de_estados h
     where h.organization_id = p_organization_id
       and h.contact_id = v_contact
       and h.id <> all (array(
         select (e ->> 'id')::uuid from jsonb_array_elements(coalesce(v_snap -> 'historico', '[]'::jsonb)) e
       ));
  end if;

  delete from public.crm_lixeira where id = p_item and organization_id = p_organization_id;
  return v_contact;
end
$f$;

-- ── 3. Quem pode chamar ────────────────────────────────────────────────────
-- As duas públicas: só usuário logado (a checagem de empresa e papel está dentro).
revoke execute on function public.fn_excluir_cliente_para_lixeira(uuid, uuid) from public, anon;
grant execute on function public.fn_excluir_cliente_para_lixeira(uuid, uuid) to authenticated;
revoke execute on function public.fn_restaurar_cliente_da_lixeira(uuid, uuid) from public, anon;
grant execute on function public.fn_restaurar_cliente_da_lixeira(uuid, uuid) to authenticated;

-- As três internas: ninguém de sessão as chama; só as duas acima, que rodam como dono. Revoga de novo
-- (idempotente) para desfazer o GRANT que alguém tenha aplicado à mão num banco existente.
revoke execute on function public.fn_historico_apagar_do_contato(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_historico_inserir_da_lixeira(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_recalcula_cliente_restaurado(uuid, uuid) from public, anon, authenticated;

comment on function public.fn_excluir_cliente_para_lixeira(uuid, uuid) is
  'Exclui o cliente (e o que depende dele) guardando a cópia na lixeira. SECURITY DEFINER: confere auth.uid(), a empresa e o papel agent+ no começo; todo acesso filtra organization_id.';
comment on function public.fn_restaurar_cliente_da_lixeira(uuid, uuid) is
  'Restaura da lixeira. SECURITY DEFINER: confere auth.uid(), a empresa, o papel agent+ e que o snapshot inteiro é da empresa.';

notify pgrst, 'reload schema';
