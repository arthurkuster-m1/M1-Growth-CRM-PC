-- manifest: **Tarefas estilo Notion.** Status editáveis por organização (`crm_task_status_options`: nome, cor e o grupo `pending/in_progress/done/cancelled` a que cada opção pertence) + `crm_tasks.status_option_id` e `crm_tasks.position` (ordem manual). O `status` antigo continua a fonte para as telas existentes: um trigger o mantém coerente com a opção escolhida.

-- ============================================================================
-- 0582 — TAREFAS ESTILO NOTION
--
-- ─── O que o produto não tinha
--
-- `crm_tasks.status` é um CHECK de quatro valores fixos. Quem quer "Em revisão"
-- ou "Aguardando cliente" não consegue — e foi o primeiro pedido de quem usa o
-- Notion. A saída do Notion é a que se copia aqui: o status que a pessoa VÊ é uma
-- OPÇÃO com nome e cor próprios, e cada opção pertence a um GRUPO fixo (a fazer,
-- em andamento, concluída, cancelada).
--
-- ─── Por que o `status` antigo NÃO sai
--
-- Início, a tela de Tarefas atual, o contador de atrasadas e a timeline do
-- negócio leem `status`. O grupo é o que mantém todos eles verdadeiros sem mudar
-- uma linha: escolher a opção "Em revisão" (grupo `in_progress`) grava
-- `status = 'in_progress'`. A decisão mora no trigger, e não em cada rota, porque
-- as telas antigas continuam gravando só `status` — e a opção tem de acompanhar.
--
-- ─── `position` numeric, e não int
--
-- Ordem manual por arraste: a linha solta entre duas outras recebe o ponto médio
-- das posições vizinhas, sem renumerar a lista (CLAUDE.md, "Modelagem": NUNCA int).
-- O padrão é o epoch em segundos, então tarefa nova nasce no fim — e a lista
-- existente é migrada para a ordem em que foi criada.
-- ============================================================================

create table if not exists public.crm_task_status_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  color text not null default 'gray',
  -- O grupo é a ponte para `crm_tasks.status`. Texto + CHECK, e não enum (CLAUDE.md).
  grupo text not null default 'pending',
  position numeric not null default extract(epoch from clock_timestamp()),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_task_status_options_name_check
    check (length(btrim(name)) > 0 and length(name) <= 60),
  constraint crm_task_status_options_color_check
    check (color in ('gray','brown','orange','yellow','green','blue','purple','pink','red')),
  constraint crm_task_status_options_grupo_check
    check (grupo in ('pending','in_progress','done','cancelled'))
);

-- Dois "Em revisão" na mesma lista seriam indistinguíveis na tela.
create unique index if not exists crm_task_status_options_org_name_uniq
  on public.crm_task_status_options (organization_id, lower(btrim(name)));

create index if not exists crm_task_status_options_org_position_idx
  on public.crm_task_status_options (organization_id, position);

alter table public.crm_task_status_options enable row level security;

-- Leitura para a organização; escrita a partir de `manager`: mudar o vocabulário
-- de status é configurar a operação, não é o gesto diário de quem atende.
drop policy if exists crm_task_status_options_select on public.crm_task_status_options;
create policy crm_task_status_options_select on public.crm_task_status_options
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists crm_task_status_options_write on public.crm_task_status_options;
create policy crm_task_status_options_write on public.crm_task_status_options
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

-- O default do baseline concede TUDO a `anon` em toda tabela nova.
revoke all on public.crm_task_status_options from anon;
grant select, insert, update, delete on public.crm_task_status_options to authenticated;
grant all on public.crm_task_status_options to service_role;

drop trigger if exists trg_crm_task_status_options_updated_at on public.crm_task_status_options;
create trigger trg_crm_task_status_options_updated_at
  before update on public.crm_task_status_options
  for each row execute function public.fn_set_updated_at();

comment on table public.crm_task_status_options is
  'Opções de status das tarefas, por organização — nome e cor livres. Cada uma pertence a um GRUPO (pending/in_progress/done/cancelled), que é o que o `crm_tasks.status` guarda para as telas que ainda não conhecem opções.';

-- ─────────────────────────────────────────────────────────────────────────────
-- As colunas novas de `crm_tasks`
--
-- `position` entra em quatro passos porque a migration tem de poder rodar de
-- novo (o `update.sh` reaplica o baseline): coluna sem default → default → migra
-- só o que ainda é NULL → NOT NULL. Reaplicar nunca reembaralha a ordem do usuário.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.crm_tasks
  add column if not exists status_option_id uuid
    references public.crm_task_status_options(id) on delete set null;

alter table public.crm_tasks add column if not exists position numeric;
alter table public.crm_tasks alter column position set default extract(epoch from clock_timestamp());
update public.crm_tasks set position = extract(epoch from created_at) where position is null;
alter table public.crm_tasks alter column position set not null;

create index if not exists crm_tasks_org_position_idx
  on public.crm_tasks (organization_id, position);

create index if not exists crm_tasks_status_option_idx
  on public.crm_tasks (status_option_id) where status_option_id is not null;

comment on column public.crm_tasks.status_option_id is
  'A opção de status escolhida (nome e cor da organização). O trigger trg_crm_tasks_sincroniza_status a mantém coerente com `status`: a opção manda quando é ela que muda; o `status` manda quando é ele (telas antigas).';
comment on column public.crm_tasks.position is
  'Ordem manual (arraste). numeric: a linha solta entre duas recebe o ponto médio das vizinhas, sem renumerar a lista. Padrão = epoch em segundos, então tarefa nova nasce no fim.';

-- ─────────────────────────────────────────────────────────────────────────────
-- As opções de fábrica: quatro, uma por grupo
--
-- Toda organização precisa de ao menos uma opção por grupo, senão "concluir" não
-- teria nome na tela. A função é idempotente e só semeia organização SEM opção
-- nenhuma — quem já personalizou não recebe de volta o que apagou.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_tarefas_semear_status(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.crm_task_status_options where organization_id = p_org) then
    return;
  end if;
  insert into public.crm_task_status_options (organization_id, name, color, grupo, position)
  values
    (p_org, 'Não iniciada', 'gray',  'pending',     1),
    (p_org, 'Em andamento', 'blue',  'in_progress', 2),
    (p_org, 'Concluída',    'green', 'done',        3),
    (p_org, 'Cancelada',    'red',   'cancelled',   4);
end;
$$;

revoke execute on function public.fn_tarefas_semear_status(uuid) from public, anon, authenticated;
grant  execute on function public.fn_tarefas_semear_status(uuid) to service_role;

create or replace function public.fn_tarefas_semear_status_trg()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_tarefas_semear_status(new.id);
  return new;
end;
$$;

revoke execute on function public.fn_tarefas_semear_status_trg() from public, anon, authenticated;
grant  execute on function public.fn_tarefas_semear_status_trg() to service_role;

drop trigger if exists trg_organizations_semeia_status_de_tarefa on public.organizations;
create trigger trg_organizations_semeia_status_de_tarefa
  after insert on public.organizations
  for each row execute function public.fn_tarefas_semear_status_trg();

-- Organizações que já existem.
select public.fn_tarefas_semear_status(id) from public.organizations;

-- ─────────────────────────────────────────────────────────────────────────────
-- Opção e `status` andam juntos
--
-- Roda como quem grava (sem `security definer`): a leitura das opções é liberada
-- a todo membro da organização pela policy de select.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_crm_tasks_sincroniza_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_grupo text;
begin
  -- 1) A opção escolhida — e válida NESTA organização — manda no status. Uma opção
  --    de outra organização (o FK sozinho não impede) é ignorada, não obedecida.
  if new.status_option_id is not null
     and (tg_op = 'INSERT' or new.status_option_id is distinct from old.status_option_id) then
    select o.grupo into v_grupo
      from public.crm_task_status_options o
     where o.id = new.status_option_id
       and o.organization_id = new.organization_id;
    if v_grupo is null then
      new.status_option_id := null;
    else
      new.status := v_grupo;
    end if;
  end if;

  -- 2) O status mudou por fora (as telas antigas só conhecem `status`): a opção
  --    que não é mais do grupo deixa de valer.
  if new.status_option_id is not null and not exists (
       select 1 from public.crm_task_status_options o
        where o.id = new.status_option_id and o.grupo = new.status
     ) then
    new.status_option_id := null;
  end if;

  -- 3) Sem opção: a primeira do grupo. Cobre tarefa criada pelas telas antigas e a
  --    opção apagada (o FK devolve NULL).
  if new.status_option_id is null then
    select o.id into new.status_option_id
      from public.crm_task_status_options o
     where o.organization_id = new.organization_id
       and o.grupo = new.status
     order by o.position
     limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crm_tasks_sincroniza_status on public.crm_tasks;
create trigger trg_crm_tasks_sincroniza_status
  before insert or update on public.crm_tasks
  for each row execute function public.fn_crm_tasks_sincroniza_status();

-- Mudar o GRUPO de uma opção move as tarefas que a usam.
create or replace function public.fn_task_status_option_grupo_mudou()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.crm_tasks
     set status = new.grupo
   where status_option_id = new.id
     and organization_id = new.organization_id
     and status is distinct from new.grupo;
  return new;
end;
$$;

drop trigger if exists trg_task_status_option_grupo_mudou on public.crm_task_status_options;
create trigger trg_task_status_option_grupo_mudou
  after update of grupo on public.crm_task_status_options
  for each row
  when (old.grupo is distinct from new.grupo)
  execute function public.fn_task_status_option_grupo_mudou();

-- As tarefas que já existiam ganham a opção do próprio grupo. Só toca o que ainda é
-- NULL, então reaplicar não desfaz escolha de ninguém.
update public.crm_tasks t
   set status_option_id = (
     select o.id from public.crm_task_status_options o
      where o.organization_id = t.organization_id and o.grupo = t.status
      order by o.position limit 1
   )
 where t.status_option_id is null;

notify pgrst, 'reload schema';
