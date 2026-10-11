-- manifest: **Cronograma do cliente.** Config e itens do cronograma geral por empresa (`marketing_cronograma_config`, `marketing_cronograma_itens`), e o que faz a tarefa aparecer na semana do cliente: `crm_tasks.cronograma_lado` ('agencia'|'cliente'), `prazo_original` e `adiamentos`, mais o histórico de prazo e situação (`crm_task_historico`, só manager+), escrito por trigger.

-- ============================================================================
-- 0591 — CRONOGRAMA DO CLIENTE
--
-- Duas frentes: o cronograma GERAL (barras por semana, itens digitados no app, sem planilha) e
-- as TAREFAS DA SEMANA, que não são uma lista à parte: são tarefas da base de Tarefas (a que a
-- agência usa no dia a dia) marcadas com `cronograma_lado`. Marcar é o que as põe na semana do
-- cliente; o cliente (viewer) só lê.
--
-- ─── O histórico ─────────────────────────────────────────────────────────────
-- `prazo_original` guarda o PRIMEIRO prazo combinado e nunca muda; `adiamentos` conta quantas
-- vezes o prazo foi empurrado para frente. Cada mudança de prazo, conclusão, reabertura e
-- cancelamento de tarefa do cronograma vira uma linha em `crm_task_historico`, com o motivo
-- quando a mudança veio pela rota do cronograma (que o passa pela configuração local
-- `m1.motivo`). Mudança feita pela tela de Tarefas fica registrada sem motivo — e o cronograma
-- convida a preenchê-lo depois. O histórico é da agência (manager+): o motivo de um atraso pode
-- ser uma conversa difícil que a agência decide se e como mostra.
-- ============================================================================

alter table public.crm_tasks
  add column if not exists cronograma_lado text,
  add column if not exists prazo_original timestamptz,
  add column if not exists adiamentos integer not null default 0;

alter table public.crm_tasks drop constraint if exists crm_tasks_cronograma_lado_check;
alter table public.crm_tasks
  add constraint crm_tasks_cronograma_lado_check
  check (cronograma_lado is null or cronograma_lado in ('agencia', 'cliente'));

-- Tarefas que já têm prazo ganham o prazo original.
update public.crm_tasks set prazo_original = due_date where prazo_original is null and due_date is not null;

create index if not exists crm_tasks_cronograma_idx
  on public.crm_tasks (organization_id, due_date)
  where cronograma_lado is not null;

comment on column public.crm_tasks.cronograma_lado is
  'Quem faz a tarefa na visão do cronograma do cliente: agencia ou cliente. Nulo = a tarefa não aparece no cronograma.';
comment on column public.crm_tasks.prazo_original is
  'O primeiro prazo combinado. Nunca muda depois de gravado; o atraso real é medido contra ele.';
comment on column public.crm_tasks.adiamentos is
  'Quantas vezes o prazo foi empurrado para uma data posterior. Mantido pelo trigger.';

create table if not exists public.crm_task_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.crm_tasks(id) on delete cascade,
  tipo text not null,
  de_prazo timestamptz,
  para_prazo timestamptz,
  situacao text,
  motivo text,
  semana_inicio date,
  autor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint crm_task_historico_tipo_check check (tipo in (
    'prazo_alterado', 'concluida', 'reaberta', 'cancelada',
    'entrou_no_cronograma', 'saiu_do_cronograma', 'fechamento_da_semana'
  )),
  constraint crm_task_historico_motivo_check check (motivo is null or length(motivo) <= 500)
);

create index if not exists crm_task_historico_task_idx
  on public.crm_task_historico (task_id, created_at desc);
create index if not exists crm_task_historico_org_idx
  on public.crm_task_historico (organization_id, created_at desc);

alter table public.crm_task_historico enable row level security;

drop policy if exists crm_task_historico_select on public.crm_task_historico;
create policy crm_task_historico_select on public.crm_task_historico
  for select using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

drop policy if exists crm_task_historico_insert on public.crm_task_historico;
create policy crm_task_historico_insert on public.crm_task_historico
  for insert with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

drop policy if exists crm_task_historico_update on public.crm_task_historico;
create policy crm_task_historico_update on public.crm_task_historico
  for update using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

revoke all on public.crm_task_historico from anon;
grant select, insert, update on public.crm_task_historico to authenticated;

-- ── Trigger 1 (BEFORE): mantém prazo_original e adiamentos.
create or replace function public.fn_crm_tasks_prazo_original()
returns trigger language plpgsql as $f$
begin
  if tg_op = 'INSERT' then
    if new.prazo_original is null then new.prazo_original := new.due_date; end if;
    return new;
  end if;
  if old.due_date is distinct from new.due_date then
    if new.prazo_original is null then
      new.prazo_original := coalesce(old.due_date, new.due_date);
    end if;
    if old.due_date is not null and new.due_date is not null and new.due_date > old.due_date then
      new.adiamentos := coalesce(old.adiamentos, 0) + 1;
    end if;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_tasks_prazo_original on public.crm_tasks;
create trigger trg_crm_tasks_prazo_original
  before insert or update on public.crm_tasks
  for each row execute function public.fn_crm_tasks_prazo_original();

-- ── Trigger 2 (AFTER): escreve o histórico das tarefas que estão no cronograma.
create or replace function public.fn_crm_tasks_historico()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_motivo text := nullif(btrim(coalesce(current_setting('m1.motivo', true), '')), '');
begin
  if tg_op = 'INSERT' then
    if new.cronograma_lado is not null then
      insert into public.crm_task_historico (organization_id, task_id, tipo, para_prazo, situacao, autor)
      values (new.organization_id, new.id, 'entrou_no_cronograma', new.due_date, new.status, auth.uid());
    end if;
    return new;
  end if;

  if old.cronograma_lado is null and new.cronograma_lado is not null then
    insert into public.crm_task_historico (organization_id, task_id, tipo, para_prazo, situacao, autor)
    values (new.organization_id, new.id, 'entrou_no_cronograma', new.due_date, new.status, auth.uid());
  elsif old.cronograma_lado is not null and new.cronograma_lado is null then
    insert into public.crm_task_historico (organization_id, task_id, tipo, de_prazo, situacao, autor)
    values (new.organization_id, new.id, 'saiu_do_cronograma', old.due_date, new.status, auth.uid());
  end if;

  if new.cronograma_lado is null then return new; end if;

  if old.due_date is distinct from new.due_date then
    insert into public.crm_task_historico
      (organization_id, task_id, tipo, de_prazo, para_prazo, situacao, motivo, autor)
    values (new.organization_id, new.id, 'prazo_alterado', old.due_date, new.due_date,
            new.status, v_motivo, auth.uid());
  end if;

  if old.status is distinct from new.status then
    if new.status = 'done' then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'concluida', new.due_date, new.status, v_motivo, auth.uid());
    elsif new.status = 'cancelled' then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'cancelada', new.due_date, new.status, v_motivo, auth.uid());
    elsif old.status in ('done', 'cancelled') then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'reaberta', new.due_date, new.status, v_motivo, auth.uid());
    end if;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_tasks_historico on public.crm_tasks;
create trigger trg_crm_tasks_historico
  after insert or update on public.crm_tasks
  for each row execute function public.fn_crm_tasks_historico();

-- ── Mudar o prazo informando o motivo (a rota do cronograma usa; obedece à RLS de quem chama).
create or replace function public.fn_cronograma_mudar_prazo(
  p_task uuid, p_novo timestamptz, p_motivo text
) returns void language plpgsql security invoker as $f$
begin
  perform set_config('m1.motivo', coalesce(left(p_motivo, 500), ''), true);
  update public.crm_tasks set due_date = p_novo where id = p_task;
  -- O motivo vale só para esta mudança: não vaza para o que a mesma transação fizer depois.
  perform set_config('m1.motivo', '', true);
end
$f$;

-- ── Cronograma geral: config e itens.
create table if not exists public.marketing_cronograma_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  total_semanas smallint not null default 8,
  -- A segunda-feira da semana 1. Nula = o cronograma mostra só "S1, S2…", sem datas.
  data_inicio date,
  subtitulo_geral text not null default '',
  subtitulo_semana text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint marketing_cronograma_semanas_check check (total_semanas between 1 and 26),
  constraint marketing_cronograma_subtitulos_check
    check (length(subtitulo_geral) <= 200 and length(subtitulo_semana) <= 200)
);

create table if not exists public.marketing_cronograma_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  acao text not null,
  semana_inicio smallint not null,
  semana_fim smallint not null,
  status text not null default 'planejado',
  destaque boolean not null default false,
  notas text not null default '',
  ordem numeric not null default extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_cronograma_itens_acao_check check (length(btrim(acao)) between 1 and 200),
  constraint marketing_cronograma_itens_semanas_check
    check (semana_inicio >= 1 and semana_fim >= semana_inicio and semana_fim <= 26),
  constraint marketing_cronograma_itens_status_check
    check (status in ('planejado', 'andamento', 'concluido')),
  constraint marketing_cronograma_itens_notas_check check (length(notas) <= 500)
);

create index if not exists marketing_cronograma_itens_org_idx
  on public.marketing_cronograma_itens (organization_id, ordem);

alter table public.marketing_cronograma_config enable row level security;
alter table public.marketing_cronograma_itens enable row level security;

drop policy if exists marketing_cronograma_config_select on public.marketing_cronograma_config;
create policy marketing_cronograma_config_select on public.marketing_cronograma_config
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists marketing_cronograma_config_write on public.marketing_cronograma_config;
create policy marketing_cronograma_config_write on public.marketing_cronograma_config
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

drop policy if exists marketing_cronograma_itens_select on public.marketing_cronograma_itens;
create policy marketing_cronograma_itens_select on public.marketing_cronograma_itens
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists marketing_cronograma_itens_write on public.marketing_cronograma_itens;
create policy marketing_cronograma_itens_write on public.marketing_cronograma_itens
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

revoke all on public.marketing_cronograma_config from anon;
revoke all on public.marketing_cronograma_itens from anon;
grant select, insert, update, delete on public.marketing_cronograma_config to authenticated;
grant select, insert, update, delete on public.marketing_cronograma_itens to authenticated;

drop trigger if exists trg_marketing_cronograma_itens_updated_at on public.marketing_cronograma_itens;
create trigger trg_marketing_cronograma_itens_updated_at
  before update on public.marketing_cronograma_itens
  for each row execute function public.fn_set_updated_at();

comment on table public.marketing_cronograma_itens is
  'As barras do cronograma geral do cliente (ação, semana de início e fim, status). Lido por toda a empresa; escrito a partir de manager.';
comment on table public.marketing_cronograma_config is
  'Configuração do cronograma do cliente: quantas semanas, a segunda-feira da semana 1 e os subtítulos.';
comment on table public.crm_task_historico is
  'Histórico de prazo e situação das tarefas que estão no cronograma do cliente. Só manager+ lê; escrito por trigger (e pela rota de fechamento da semana).';

-- ── Metas do cronograma (o topo da página: onde queremos chegar) e fase de cada ação.
alter table public.marketing_cronograma_itens
  add column if not exists fase text not null default '';
alter table public.marketing_cronograma_itens drop constraint if exists marketing_cronograma_itens_fase_check;
alter table public.marketing_cronograma_itens
  add constraint marketing_cronograma_itens_fase_check check (length(fase) <= 80);

create table if not exists public.marketing_cronograma_metas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  titulo text not null,
  -- Texto livre ("R$ 8.000/mês", "6 clientes"): a tela tenta ler como número para o progresso.
  alvo text not null default '',
  atual text not null default '',
  descricao text not null default '',
  ordem numeric not null default extract(epoch from clock_timestamp()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_cronograma_metas_titulo_check check (length(btrim(titulo)) between 1 and 120),
  constraint marketing_cronograma_metas_textos_check
    check (length(alvo) <= 40 and length(atual) <= 40 and length(descricao) <= 200)
);

create index if not exists marketing_cronograma_metas_org_idx
  on public.marketing_cronograma_metas (organization_id, ordem);

alter table public.marketing_cronograma_metas enable row level security;

drop policy if exists marketing_cronograma_metas_select on public.marketing_cronograma_metas;
create policy marketing_cronograma_metas_select on public.marketing_cronograma_metas
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists marketing_cronograma_metas_write on public.marketing_cronograma_metas;
create policy marketing_cronograma_metas_write on public.marketing_cronograma_metas
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

revoke all on public.marketing_cronograma_metas from anon;
grant select, insert, update, delete on public.marketing_cronograma_metas to authenticated;

drop trigger if exists trg_marketing_cronograma_metas_updated_at on public.marketing_cronograma_metas;
create trigger trg_marketing_cronograma_metas_updated_at
  before update on public.marketing_cronograma_metas
  for each row execute function public.fn_set_updated_at();

comment on table public.marketing_cronograma_metas is
  'As metas do cronograma do cliente (o topo: onde queremos chegar), com alvo e valor atual em texto livre. Lido por toda a empresa; escrito a partir de manager.';

notify pgrst, 'reload schema';
