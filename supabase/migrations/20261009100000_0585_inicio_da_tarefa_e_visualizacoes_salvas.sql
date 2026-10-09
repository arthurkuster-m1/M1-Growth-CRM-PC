-- manifest: **Início da tarefa e visualizações salvas.** `crm_tasks.start_date` (o início da barra na Linha do tempo, editável) e `crm_saved_views`: as visualizações nomeadas das telas estilo Notion (tabela, quadro, calendário, linha do tempo), cada uma com seu tipo e sua configuração (filtros, ordenação, agrupamento, colunas), compartilhadas pela organização — lidas por todos, criadas e editadas a partir de `agent`.

-- ============================================================================
-- 0585 — INÍCIO DA TAREFA E VISUALIZAÇÕES SALVAS
--
-- ─── `crm_tasks.start_date`
--
-- A Linha do tempo precisa de um começo para a barra. Até aqui ela usava a data de
-- criação, que ninguém edita — e o Arthur quer arrastar a barra. Nulo = "sem início":
-- a barra, nesse caso, nasce no prazo (um dia só) e a tela mostra isso.
--
-- ─── `crm_saved_views`
--
-- No Notion a visualização é da página, não da pessoa: o time inteiro vê as mesmas
-- abas ("Minhas tarefas", "Quadro da semana"...). Cada linha é UMA aba: nome, tipo e
-- `config` (a mesma forma de `user_view_preferences.config`, validada pela rota).
-- A visualização de fábrica ("Tabela") não mora aqui: continua sendo a preferência
-- pessoal de 0583, para nada do que já existe mudar de lugar.
-- ============================================================================

alter table public.crm_tasks
  add column if not exists start_date timestamptz;

comment on column public.crm_tasks.start_date is
  'Início da tarefa (barra da Linha do tempo). Nulo = sem início; a barra então começa no prazo. Quem a edita é a tela; o banco não obriga início <= prazo.';

create table if not exists public.crm_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Qual tela: `tarefas` hoje; `crm`, `produtos`... depois.
  screen_key text not null,
  name text not null,
  -- Texto + CHECK, e não enum (CLAUDE.md).
  type text not null default 'tabela',
  config jsonb not null default '{}'::jsonb,
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_saved_views_name_check
    check (length(btrim(name)) > 0 and length(name) <= 60),
  constraint crm_saved_views_screen_check
    check (screen_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  constraint crm_saved_views_type_check
    check (type in ('tabela','kanban','calendario','timeline')),
  constraint crm_saved_views_config_check
    check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 20000)
);

create index if not exists crm_saved_views_org_screen_position_idx
  on public.crm_saved_views (organization_id, screen_key, position);

alter table public.crm_saved_views enable row level security;

-- Todo membro da organização VÊ as visualizações; criar, editar e apagar é de `agent` para
-- cima, o mesmo corte de editar as tarefas.
drop policy if exists crm_saved_views_select on public.crm_saved_views;
create policy crm_saved_views_select on public.crm_saved_views
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists crm_saved_views_write on public.crm_saved_views;
create policy crm_saved_views_write on public.crm_saved_views
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

-- O default do baseline concede TUDO a `anon` em toda tabela nova.
revoke all on public.crm_saved_views from anon;
grant select, insert, update, delete on public.crm_saved_views to authenticated;
grant all on public.crm_saved_views to service_role;

drop trigger if exists trg_crm_saved_views_updated_at on public.crm_saved_views;
create trigger trg_crm_saved_views_updated_at
  before update on public.crm_saved_views
  for each row execute function public.fn_set_updated_at();

comment on table public.crm_saved_views is
  'As visualizações nomeadas das telas estilo Notion (aba = nome + tipo + config), compartilhadas pela organização. A visualização de fábrica ("Tabela") continua em user_view_preferences (0583). A forma do config é validada pela rota; o banco só limita o tamanho.';

notify pgrst, 'reload schema';
