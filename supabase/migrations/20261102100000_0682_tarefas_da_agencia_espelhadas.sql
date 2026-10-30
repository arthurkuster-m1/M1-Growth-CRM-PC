-- manifest: **Tarefas da agência espelhadas entre a agência e o cliente.** `contacts.linked_organization_id` liga o contato (o cliente no CRM da agência) à ORGANIZAÇÃO dele (só o super-admin liga); `crm_tasks.mirror_task_id` aponta a cópia da tarefa na outra empresa. A tarefa da agência ligada a esse contato nasce também na empresa do cliente (marcada "da agência" no cronograma), e a marcada "da agência" na empresa do cliente nasce também na agência, com o contato; título, descrição, prazo, início, prioridade e situação ficam iguais dos dois lados; apagar de um lado apaga o outro.
alter table public.contacts
  add column if not exists linked_organization_id uuid references public.organizations(id) on delete set null;
create unique index if not exists uniq_contacts_org_vinculada
  on public.contacts (organization_id, linked_organization_id) where linked_organization_id is not null;
create index if not exists idx_contacts_org_vinculada
  on public.contacts (linked_organization_id) where linked_organization_id is not null;

alter table public.crm_tasks
  add column if not exists mirror_task_id uuid references public.crm_tasks(id) on delete set null;
create index if not exists idx_crm_tasks_mirror
  on public.crm_tasks (mirror_task_id) where mirror_task_id is not null;

-- Só o super-admin da plataforma (ou o servidor, sem sessão) liga um contato a uma organização: o vínculo
-- faz o servidor escrever na empresa do cliente, então não pode ser definido por qualquer membro.
create or replace function public.fn_contacts_vinculo_so_do_super_admin()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.linked_organization_id is not null
     and (tg_op = 'INSERT' or new.linked_organization_id is distinct from old.linked_organization_id) then
    if new.linked_organization_id = new.organization_id then
      raise exception 'vinculo_com_a_propria_organizacao' using errcode = '22023';
    end if;
    if auth.uid() is not null and not public.fn_is_platform_admin_full() then
      raise exception 'vinculo_so_do_super_admin' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_contacts_vinculo_so_do_super_admin on public.contacts;
create trigger trg_contacts_vinculo_so_do_super_admin
  before insert or update of linked_organization_id on public.contacts
  for each row execute function public.fn_contacts_vinculo_so_do_super_admin();

-- O contato da agência ligado à organização `p_org` (o cliente), ou nada.
create or replace function public.fn_agencia_contato_do_cliente(p_org uuid)
returns table (contact_id uuid, agencia_org uuid)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.organization_id from public.contacts c
   where c.linked_organization_id = p_org order by c.created_at limit 1;
$$;
revoke all on function public.fn_agencia_contato_do_cliente(uuid) from public, anon, authenticated;

-- Cria a cópia de uma tarefa na outra empresa e liga as duas pela `mirror_task_id`.
create or replace function public.fn_tarefa_criar_espelho(p_tarefa public.crm_tasks)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_contato uuid;
  v_cliente uuid;
  v_agencia uuid;
  v_copia uuid;
begin
  if p_tarefa.mirror_task_id is not null then return; end if;
  -- Lado da AGÊNCIA: a tarefa é de um contato ligado a uma organização cliente.
  v_contato := coalesce(p_tarefa.contact_id, (select l.contact_id from public.crm_leads l where l.id = p_tarefa.lead_id));
  if v_contato is not null then
    select c.linked_organization_id into v_cliente from public.contacts c
     where c.id = v_contato and c.organization_id = p_tarefa.organization_id;
    if v_cliente is not null then
      insert into public.crm_tasks (organization_id, title, description, due_date, start_date, priority, status,
                                    cronograma_lado, mirror_task_id, created_by)
      values (v_cliente, p_tarefa.title, p_tarefa.description, p_tarefa.due_date, p_tarefa.start_date,
              p_tarefa.priority, p_tarefa.status, 'agencia', p_tarefa.id, p_tarefa.created_by)
      returning id into v_copia;
      update public.crm_tasks set mirror_task_id = v_copia where id = p_tarefa.id;
      return;
    end if;
  end if;
  -- Lado do CLIENTE: a tarefa está marcada "da agência" e a empresa é cliente de uma agência.
  if p_tarefa.cronograma_lado = 'agencia' then
    select a.contact_id, a.agencia_org into v_contato, v_agencia
      from public.fn_agencia_contato_do_cliente(p_tarefa.organization_id) a;
    if v_agencia is not null then
      insert into public.crm_tasks (organization_id, contact_id, title, description, due_date, start_date, priority,
                                    status, mirror_task_id, created_by)
      values (v_agencia, v_contato, p_tarefa.title, p_tarefa.description, p_tarefa.due_date, p_tarefa.start_date,
              p_tarefa.priority, p_tarefa.status, p_tarefa.id, p_tarefa.created_by)
      returning id into v_copia;
      update public.crm_tasks set mirror_task_id = v_copia where id = p_tarefa.id;
    end if;
  end if;
end $$;
revoke all on function public.fn_tarefa_criar_espelho(public.crm_tasks) from public, anon, authenticated;

create or replace function public.fn_crm_tasks_espelho()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    -- Só o apagar de quem usa a tela leva a cópia junto; o apagar encadeado por este gatilho não volta.
    if old.mirror_task_id is not null and pg_trigger_depth() = 1 then
      delete from public.crm_tasks where id = old.mirror_task_id;
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform public.fn_tarefa_criar_espelho(new);
    return new;
  end if;
  -- UPDATE
  if new.mirror_task_id is null then
    -- Marcou "da agência" na empresa do cliente (ou ligou o contato depois): nasce a cópia.
    perform public.fn_tarefa_criar_espelho(new);
    return new;
  end if;
  -- Desmarcou "da agência" na empresa do cliente: a cópia da agência sai e as duas se desligam.
  if old.cronograma_lado = 'agencia' and new.cronograma_lado is distinct from 'agencia'
     and exists (select 1 from public.fn_agencia_contato_do_cliente(new.organization_id)) then
    update public.crm_tasks set mirror_task_id = null where id = new.id;
    delete from public.crm_tasks where id = new.mirror_task_id;
    return new;
  end if;
  update public.crm_tasks m set
    title = new.title, description = new.description, due_date = new.due_date, start_date = new.start_date,
    priority = new.priority, status = new.status
   where m.id = new.mirror_task_id
     and (m.title, m.description, m.due_date, m.start_date, m.priority, m.status)
         is distinct from (new.title, new.description, new.due_date, new.start_date, new.priority, new.status);
  return new;
end $$;
revoke all on function public.fn_crm_tasks_espelho() from public, anon, authenticated;
drop trigger if exists trg_crm_tasks_espelho on public.crm_tasks;
create trigger trg_crm_tasks_espelho
  after insert or update or delete on public.crm_tasks
  for each row execute function public.fn_crm_tasks_espelho();

-- Ligou o contato a uma organização: as tarefas que já existiam (abertas) ganham a cópia.
create or replace function public.fn_contacts_vinculou_organizacao()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.crm_tasks;
begin
  if new.linked_organization_id is null or new.linked_organization_id is not distinct from old.linked_organization_id then
    return new;
  end if;
  for t in
    select * from public.crm_tasks
     where mirror_task_id is null and status in ('pending', 'in_progress')
       and ((organization_id = new.organization_id and (contact_id = new.id
              or lead_id in (select l.id from public.crm_leads l where l.contact_id = new.id)))
         or (organization_id = new.linked_organization_id and cronograma_lado = 'agencia'))
  loop
    perform public.fn_tarefa_criar_espelho(t);
  end loop;
  return new;
end $$;
revoke all on function public.fn_contacts_vinculou_organizacao() from public, anon, authenticated;
drop trigger if exists trg_contacts_vinculou_organizacao on public.contacts;
create trigger trg_contacts_vinculou_organizacao
  after update of linked_organization_id on public.contacts
  for each row execute function public.fn_contacts_vinculou_organizacao();
