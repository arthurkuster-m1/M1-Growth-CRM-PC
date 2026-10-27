-- manifest: Agenda dos colegas ganha "ver" (settings.colegas_podem_ver_agenda, ausente = liga) com fn_colegas_podem_ver_agenda e fn_definir_colegas_podem_ver_agenda (piso admin; "mexer" também sobe para admin); desliga "clientes pela agenda" em todas as organizações (cliente só é cliente com venda).

-- ---- 1. VER A AGENDA DOS COLEGAS ---------------------------------------------
-- Ausente = ligado (quem já instalou não vê mudança). Só o booleano false explícito desliga.
create or replace function public.fn_colegas_podem_ver_agenda(p_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(
   (select (o.settings->'colegas_podem_ver_agenda') is distinct from 'false'::jsonb
      from public.organizations o where o.id = p_org),
   true);
$$;
revoke all on function public.fn_colegas_podem_ver_agenda(uuid) from public,anon;
grant execute on function public.fn_colegas_podem_ver_agenda(uuid) to authenticated,service_role;

-- Porta de escrita: só administrador, como as demais regras da agenda por organização.
create or replace function public.fn_definir_colegas_podem_ver_agenda(p_org uuid,p_ligado boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_atual boolean; v_linhas int;
begin
 if p_ligado is null then raise exception 'agenda_dos_colegas_invalido' using errcode='22023'; end if;
 if auth.uid() is null
    or not public.fn_role_at_least(p_org,'admin')
    or not public.fn_support_write_allowed(p_org) then
  raise exception 'agenda_dos_colegas_forbidden' using errcode='42501';
 end if;
 if not public.fn_session_mfa_proven() then raise exception 'mfa_required' using errcode='42501'; end if;
 v_atual := public.fn_colegas_podem_ver_agenda(p_org);
 if v_atual is not distinct from p_ligado then
  return jsonb_build_object('ligado',v_atual,'mudou',false);
 end if;
 update public.organizations
    set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object('colegas_podem_ver_agenda',to_jsonb(p_ligado))
  where id = p_org;
 get diagnostics v_linhas = row_count;
 if v_linhas = 0 then raise exception 'agenda_dos_colegas_sem_organizacao' using errcode='P0002'; end if;
 return jsonb_build_object('ligado',p_ligado,'mudou',true);
end; $$;
revoke all on function public.fn_definir_colegas_podem_ver_agenda(uuid,boolean) from public,anon;
grant execute on function public.fn_definir_colegas_podem_ver_agenda(uuid,boolean) to authenticated;

-- "Mexer" passa a ser só de administrador também (a tela é uma só).
create or replace function public.fn_definir_colegas_podem_mexer_na_agenda(p_org uuid,p_ligado boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_atual boolean; v_linhas int;
begin
 if p_ligado is null then raise exception 'agenda_dos_colegas_invalido' using errcode='22023'; end if;
 if auth.uid() is null
    or not public.fn_role_at_least(p_org,'admin')
    or not public.fn_support_write_allowed(p_org) then
  raise exception 'agenda_dos_colegas_forbidden' using errcode='42501';
 end if;
 if not public.fn_session_mfa_proven() then raise exception 'mfa_required' using errcode='42501'; end if;
 v_atual := public.fn_colegas_podem_mexer_na_agenda(p_org);
 if v_atual is not distinct from p_ligado then
  return jsonb_build_object('ligado',v_atual,'mudou',false);
 end if;
 update public.organizations
    set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object('colegas_podem_mexer_na_agenda',to_jsonb(p_ligado))
  where id = p_org;
 get diagnostics v_linhas = row_count;
 if v_linhas = 0 then raise exception 'agenda_dos_colegas_sem_organizacao' using errcode='P0002'; end if;
 return jsonb_build_object('ligado',p_ligado,'mudou',true);
end; $$;
revoke all on function public.fn_definir_colegas_podem_mexer_na_agenda(uuid,boolean) from public,anon;
grant execute on function public.fn_definir_colegas_podem_mexer_na_agenda(uuid,boolean) to authenticated;

-- ---- 2. "CLIENTES PELA AGENDA" SAIU DO PRODUTO --------------------------------
-- Cliente é quem tem venda. A opção deixa de existir na tela; aqui ela é desligada em toda
-- organização que a tinha ligada, para os gatilhos de agendamento pararem de etiquetar.
-- Idempotente: só toca em quem tem o booleano true.
update public.organizations
   set settings = jsonb_set(settings, '{crm,cliente_pela_agenda}', 'false'::jsonb, true)
 where (settings -> 'crm' -> 'cliente_pela_agenda') = 'true'::jsonb;

notify pgrst,'reload schema';
