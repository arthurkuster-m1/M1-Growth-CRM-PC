-- manifest: **Anotações A2: busca, favoritos, recentes e Caixa de entrada.** `notes_pages` ganha `kind` (única `inbox` por organização), `search_text`/`search_fold`/`title_fold` (busca sem acento, mantida pela rota) e a tabela `notes_user_state` (favorita e último acesso por pessoa, RLS só do próprio usuário). Aditiva; títulos existentes entram na busca por backfill.

-- ============================================================================
-- 0687 — ANOTAÇÕES A2: busca, favoritos, recentes e Caixa de entrada
--
-- Busca: três colunas de texto mantidas pela rota (não por trigger — o texto vem de dentro do
-- documento do editor, que o servidor da aplicação sabe percorrer): `search_text` (o texto do
-- documento), `search_fold` (o mesmo, em minúsculas e sem acento) e `title_fold` (o título, idem).
-- Estado por pessoa: favorita e último acesso, em `notes_user_state`. Caixa de entrada: uma página
-- por organização marcada com `kind = 'inbox'`, onde a captura rápida acrescenta as anotações.
-- ============================================================================

alter table public.notes_pages add column if not exists kind text;
alter table public.notes_pages add column if not exists search_text text not null default '';
alter table public.notes_pages add column if not exists search_fold text not null default '';
alter table public.notes_pages add column if not exists title_fold text not null default '';

alter table public.notes_pages drop constraint if exists notes_pages_kind_check;
alter table public.notes_pages add constraint notes_pages_kind_check
  check (kind is null or kind = 'inbox');
alter table public.notes_pages drop constraint if exists notes_pages_search_check;
alter table public.notes_pages add constraint notes_pages_search_check
  check (length(search_text) <= 400000 and length(search_fold) <= 400000 and length(title_fold) <= 400);

create unique index if not exists notes_pages_inbox_uniq
  on public.notes_pages (organization_id) where kind = 'inbox';

-- Títulos já existentes entram na busca (o texto dos documentos entra na próxima gravação de cada página).
update public.notes_pages
   set title_fold = lower(translate(title, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                                           'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'))
 where title <> '' and title_fold = '';

create table if not exists public.notes_user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid not null references public.notes_pages(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  favorite boolean not null default false,
  last_opened_at timestamptz,
  primary key (user_id, page_id)
);

create index if not exists notes_user_state_org_idx
  on public.notes_user_state (user_id, organization_id);

alter table public.notes_user_state enable row level security;

-- Cada pessoa só vê e mexe no próprio estado, e só nas organizações dela.
drop policy if exists notes_user_state_own on public.notes_user_state;
create policy notes_user_state_own on public.notes_user_state
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()))
  with check (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));

comment on table public.notes_user_state is
  'Anotações: favorita e último acesso de cada pessoa a cada página.';
