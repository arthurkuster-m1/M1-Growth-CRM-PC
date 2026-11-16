-- manifest: **Timer das tarefas: "Em andamento" e cancelar o que dura menos de 5 s.** Iniciar o cronômetro passa a tarefa para o status Em andamento (guarda o status de antes em `status_antes`/`status_option_antes`); parar em menos de 5 segundos CANCELA o lançamento (apaga) e devolve o status de antes se foi o cronômetro que a pôs em andamento; de 5 s para cima conta. `fn_timer_fechar` (interna) aplica a regra a todo fechamento (parar, trocar de tarefa, concluir). As funções públicas viram `security definer` com checagem explícita de empresa e papel (atendente+), porque agora apagam lançamento e mexem no status. Aditiva (2 colunas nulas) + `create or replace`.

-- ============================================================================
-- 0690 — TIMER DAS TAREFAS: "Em andamento" e o corte de 5 segundos
--
-- 1. Iniciar o cronômetro põe a tarefa em "Em andamento" (grupo `in_progress`; o gatilho de
--    status escolhe a opção do grupo).
-- 2. Um clique que dura menos de 5 segundos foi engano: o lançamento é APAGADO e, se foi ele que
--    mudou o status da tarefa, o status volta ao que era. A partir de 5 s o tempo conta.
-- ============================================================================

alter table public.crm_task_time_entries add column if not exists status_antes text;
alter table public.crm_task_time_entries add column if not exists status_option_antes uuid;

-- ── Fechar lançamentos (interna: nenhum papel de usuário a chama direto) ─────
create or replace function public.fn_timer_fechar(p_organization_id uuid, p_user uuid, p_task uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  e record;
begin
  for e in
    select * from public.crm_task_time_entries
     where organization_id = p_organization_id and ended_at is null
       and (p_user is null or user_id = p_user)
       and (p_task is null or task_id = p_task)
     for update
  loop
    if now() - e.started_at < interval '5 seconds' then
      -- Engano (menos de 5 s): o lançamento some, como se não tivesse acontecido.
      delete from public.crm_task_time_entries where id = e.id;
      -- Se foi este cronômetro que pôs a tarefa em andamento e ninguém mais está cronometrando
      -- nela, ela volta ao status de antes.
      if e.status_antes is not null
         and not exists (select 1 from public.crm_task_time_entries
                          where task_id = e.task_id and ended_at is null) then
        update public.crm_tasks
           set status = e.status_antes, status_option_id = e.status_option_antes
         where id = e.task_id and organization_id = p_organization_id and status = 'in_progress';
      end if;
    else
      update public.crm_task_time_entries set ended_at = now() where id = e.id;
    end if;
  end loop;
end
$f$;

-- ── Iniciar: cronometra e passa a tarefa para Em andamento ───────────────────
create or replace function public.fn_tarefa_timer_iniciar(p_task uuid, p_organization_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_status text;
  v_opcao uuid;
begin
  if auth.uid() is null
     or not (p_organization_id in (select public.fn_user_org_ids()))
     or not public.fn_role_at_least(p_organization_id, 'agent') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select status, status_option_id into v_status, v_opcao from public.crm_tasks
   where id = p_task and organization_id = p_organization_id;
  if not found then
    raise exception 'tarefa_nao_encontrada' using errcode = 'P0002';
  end if;
  if v_status in ('done', 'cancelled') then
    raise exception 'tarefa_encerrada' using errcode = 'P0001';
  end if;
  -- Já está cronometrando ESTA tarefa: nada a fazer (clique duplo não cria lançamento).
  if exists (select 1 from public.crm_task_time_entries
              where organization_id = p_organization_id and task_id = p_task
                and user_id = auth.uid() and ended_at is null) then
    return;
  end if;
  -- Um cronômetro por pessoa: o de outra tarefa fecha agora (com a mesma regra dos 5 s).
  perform public.fn_timer_fechar(p_organization_id, auth.uid(), null);

  insert into public.crm_task_time_entries
    (organization_id, task_id, user_id, status_antes, status_option_antes)
  values (
    p_organization_id, p_task, auth.uid(),
    case when v_status <> 'in_progress' then v_status end,
    case when v_status <> 'in_progress' then v_opcao end
  );
  -- Cronometrando = em andamento (o gatilho de status escolhe a opção do grupo).
  if v_status <> 'in_progress' then
    update public.crm_tasks set status = 'in_progress', status_option_id = null
     where id = p_task and organization_id = p_organization_id;
  end if;
end
$f$;

-- ── Parar: de 5 s para cima conta; menos que isso cancela ────────────────────
create or replace function public.fn_tarefa_timer_parar(p_task uuid, p_organization_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if auth.uid() is null
     or not (p_organization_id in (select public.fn_user_org_ids()))
     or not public.fn_role_at_least(p_organization_id, 'agent') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  perform public.fn_timer_fechar(p_organization_id, auth.uid(), p_task);
end
$f$;

-- ── Concluir/cancelar a tarefa fecha os cronômetros dela (mesma regra) ───────
create or replace function public.fn_tarefa_encerrada_fecha_timer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if new.status in ('done', 'cancelled') and old.status is distinct from new.status then
    perform public.fn_timer_fechar(new.organization_id, null, new.id);
  end if;
  return new;
end
$f$;

revoke execute on function public.fn_timer_fechar(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_tarefa_timer_iniciar(uuid, uuid) from public, anon;
revoke execute on function public.fn_tarefa_timer_parar(uuid, uuid) from public, anon;
revoke execute on function public.fn_tarefa_encerrada_fecha_timer() from public, anon;
grant execute on function public.fn_tarefa_timer_iniciar(uuid, uuid) to authenticated;
grant execute on function public.fn_tarefa_timer_parar(uuid, uuid) to authenticated;
