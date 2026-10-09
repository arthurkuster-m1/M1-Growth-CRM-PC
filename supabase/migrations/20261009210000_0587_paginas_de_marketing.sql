-- manifest: **Páginas de Marketing e links de compartilhamento.** `marketing_pages` (o conteúdo PUBLICADO de cada módulo da estratégia, por empresa — o que o cliente vê), `marketing_page_drafts` (o rascunho que a agência edita, invisível ao cliente) e `marketing_share_links` (o link sem login que a agência entrega ao cliente). Leitura do publicado: toda a empresa; rascunho, criação, publicação e links: a partir de `manager`.

-- ============================================================================
-- 0587 — PÁGINAS DE MARKETING
--
-- ─── Por que rascunho e publicado em TABELAS diferentes
--
-- O cliente é `viewer` da própria empresa e lê o banco com o JWT dele. A RLS do Postgres filtra
-- LINHAS, não colunas: uma tabela só, com `draft_blocks` e `published_blocks`, deixaria o
-- cliente ler o rascunho (a análise ainda não revisada, o preço que a agência ainda vai
-- mudar) por uma consulta direta. Com duas tabelas, a política do rascunho simplesmente exige
-- `manager`: o cliente não tem linha nenhuma para ver.
--
-- ─── Quem é "a agência"
--
-- `manager` ou acima na empresa do cliente (e o admin da plataforma, em modo suporte). O
-- cliente entra como `viewer` e só LÊ o publicado.
--
-- ─── O link sem login
--
-- `marketing_share_links.token` é um segredo ao portador: quem tem o link vê o que foi
-- publicado, e nada mais. A tabela só é legível a partir de `manager` (a agência copia o link
-- quando quiser); a rota pública `/p/<token>` resolve o token com a chave de serviço, no
-- servidor, e devolve só conteúdo publicado da empresa dona do link.
-- ============================================================================

create table if not exists public.marketing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Qual módulo da estratégia ("onboarding", "estudo-de-persona"…): a lista fixa mora no código.
  module_key text not null,
  title text not null default '',
  -- O que o cliente vê. Nulo = ainda não publicado ("em breve").
  published_blocks jsonb,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint marketing_pages_module_check check (module_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint marketing_pages_title_check check (length(title) <= 200),
  constraint marketing_pages_published_check
    check (
      published_blocks is null
      or (jsonb_typeof(published_blocks) = 'array' and pg_column_size(published_blocks) <= 400000)
    )
);

create unique index if not exists marketing_pages_org_module_uniq
  on public.marketing_pages (organization_id, module_key);

create table if not exists public.marketing_page_drafts (
  page_id uuid primary key references public.marketing_pages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  blocks jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint marketing_page_drafts_blocks_check
    check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 400000)
);

create table if not exists public.marketing_share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Nulo = o painel inteiro (todas as páginas publicadas); preenchido = só aquele módulo.
  module_key text,
  token text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,

  constraint marketing_share_links_token_check check (length(token) >= 32),
  constraint marketing_share_links_module_check
    check (module_key is null or module_key ~ '^[a-z0-9][a-z0-9-]{0,63}$')
);

create unique index if not exists marketing_share_links_token_uniq
  on public.marketing_share_links (token);
create index if not exists marketing_share_links_org_idx
  on public.marketing_share_links (organization_id, created_at desc);

alter table public.marketing_pages enable row level security;
alter table public.marketing_page_drafts enable row level security;
alter table public.marketing_share_links enable row level security;

-- ── marketing_pages: o publicado é de TODA a empresa; escrever, só a agência.
drop policy if exists marketing_pages_select on public.marketing_pages;
create policy marketing_pages_select on public.marketing_pages
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists marketing_pages_write on public.marketing_pages;
create policy marketing_pages_write on public.marketing_pages
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

-- ── rascunhos e links: nem LER sem ser da agência.
drop policy if exists marketing_page_drafts_agency on public.marketing_page_drafts;
create policy marketing_page_drafts_agency on public.marketing_page_drafts
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

drop policy if exists marketing_share_links_agency on public.marketing_share_links;
create policy marketing_share_links_agency on public.marketing_share_links
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
revoke all on public.marketing_pages from anon;
revoke all on public.marketing_page_drafts from anon;
revoke all on public.marketing_share_links from anon;
grant select, insert, update, delete on public.marketing_pages to authenticated;
grant select, insert, update, delete on public.marketing_page_drafts to authenticated;
grant select, insert, update, delete on public.marketing_share_links to authenticated;
grant all on public.marketing_pages to service_role;
grant all on public.marketing_page_drafts to service_role;
grant all on public.marketing_share_links to service_role;

drop trigger if exists trg_marketing_pages_updated_at on public.marketing_pages;
create trigger trg_marketing_pages_updated_at
  before update on public.marketing_pages
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_marketing_page_drafts_updated_at on public.marketing_page_drafts;
create trigger trg_marketing_page_drafts_updated_at
  before update on public.marketing_page_drafts
  for each row execute function public.fn_set_updated_at();

comment on table public.marketing_pages is
  'O conteúdo PUBLICADO de cada módulo da estratégia de marketing, por empresa. Lido por toda a empresa (o cliente é viewer); escrito a partir de manager. O rascunho mora em marketing_page_drafts, que o cliente não lê.';
comment on table public.marketing_page_drafts is
  'O rascunho de uma página de marketing, editado pela agência (manager+). Separado do publicado porque a RLS filtra linhas, não colunas: o cliente não pode ler o que ainda não foi publicado.';
comment on table public.marketing_share_links is
  'Links sem login que a agência entrega ao cliente: o token é um segredo ao portador que abre só o conteúdo PUBLICADO (rota /p/<token>, resolvida no servidor). Legível só a partir de manager.';

notify pgrst, 'reload schema';
