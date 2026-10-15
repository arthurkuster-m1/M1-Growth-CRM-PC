-- manifest: **Restaurar da lixeira mescla com o cadastro novo.** Se o lead excluído já voltou a falar e ganhou um cadastro novo (mesmo telefone, e-mail ou identidade), restaurar não dá mais erro: o histórico antigo (oportunidades, vendas, conversas, tarefas, notas) é anexado ao cadastro novo, que fica com as tags das duas pontas, o nome e a origem do cadastro mais antigo e o que já tinha preenchido. Conversas do mesmo canal viram uma só.

create or replace function public.fn_restaurar_cliente_da_lixeira(
  p_item uuid, p_organization_id uuid
) returns uuid language plpgsql set search_path = public, pg_temp as $f$
declare
  v_item public.crm_lixeira%rowtype;
  v_snap jsonb;
  v_linha jsonb;
  v_contact uuid;
  v_novo uuid;
  v_c jsonb;
  v_existente uuid;
  v_mesclou boolean := false;
begin
  select * into v_item from public.crm_lixeira
   where id = p_item and organization_id = p_organization_id;
  if not found then
    return null;
  end if;
  v_snap := v_item.snapshot;
  v_contact := v_item.contact_id;
  v_c := v_snap -> 'contato';

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
     where n.id = v_novo;
  else
    perform public.fn_inserir_da_lixeira('public.contacts', v_snap -> 'contato');
  end if;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'conversas') loop
    if not exists (select 1 from public.conversations where id = (v_linha ->> 'id')::uuid) then
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

  delete from public.crm_lixeira where id = p_item;
  return v_contact;
end
$f$;
