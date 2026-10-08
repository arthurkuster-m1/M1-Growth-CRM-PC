-- manifest: **Preferências de visualização por pessoa.** `user_view_preferences`: a ordem, a largura e a visibilidade das colunas das tabelas estilo Notion (e o que vier depois: filtros, ordenação), guardadas por usuário, organização e tela — para a escolha seguir a pessoa entre o computador e o celular.

-- ============================================================================
-- 0583 — PREFERÊNCIAS DE VISUALIZAÇÃO POR PESSOA
--
-- ─── Por que no banco, e não no navegador
--
-- A ordem e a largura das colunas começaram no `localStorage` (migration 0582 e a
-- tela de Tarefas). Funciona até a pessoa abrir o sistema no celular — e ver as
-- colunas do jeito de fábrica, outra vez. Preferência de apresentação que não
-- acompanha a pessoa não é preferência, é sorte.
--
-- ─── Por que por PESSOA, e não da organização
--
-- No Notion a visualização é compartilhada; aqui, não: quem arrasta uma coluna para
-- o lado não está redefinindo o sistema para a equipe inteira. O que é da
-- organização (as propriedades em si, os nomes e as opções) mora em tabelas próprias
-- (0584). A pessoa só escolhe COMO ver.
--
-- ─── `config` jsonb com teto de tamanho
--
-- O conteúdo é aberto de propósito: a mesma linha vai ganhar filtros e ordenações.
-- A forma é validada pela rota (Zod); o banco só garante o limite — uma linha de
-- preferência não pode virar depósito de arquivo.
-- ============================================================================

create table if not exists public.user_view_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Qual tela/tabela: `tarefas`, e depois `crm`, `produtos`...
  view_key text not null,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),

  primary key (user_id, organization_id, view_key),
  constraint user_view_preferences_key_check check (length(view_key) between 1 and 80),
  constraint user_view_preferences_config_tamanho check (pg_column_size(config) <= 20000)
);

alter table public.user_view_preferences enable row level security;

-- Só a própria pessoa lê e escreve a própria preferência, e só nas organizações em que
-- ela é membro. Nem o `manager` da organização enxerga a de outro: é dado de uso.
drop policy if exists user_view_preferences_own on public.user_view_preferences;
create policy user_view_preferences_own on public.user_view_preferences
  using (
    user_id = auth.uid()
    and organization_id in (select public.fn_user_org_ids())
  )
  with check (
    user_id = auth.uid()
    and organization_id in (select public.fn_user_org_ids())
  );

-- O default do baseline concede TUDO a `anon` em toda tabela nova.
revoke all on public.user_view_preferences from anon;
grant select, insert, update, delete on public.user_view_preferences to authenticated;
grant all on public.user_view_preferences to service_role;

drop trigger if exists trg_user_view_preferences_updated_at on public.user_view_preferences;
create trigger trg_user_view_preferences_updated_at
  before update on public.user_view_preferences
  for each row execute function public.fn_set_updated_at();

comment on table public.user_view_preferences is
  'Como CADA PESSOA vê as tabelas estilo Notion: ordem, largura e visibilidade das colunas (e, depois, filtros e ordenações). Por usuário + organização + tela, para a escolha acompanhar a pessoa entre dispositivos. A forma do config é validada pela rota; o banco só limita o tamanho.';

notify pgrst, 'reload schema';
