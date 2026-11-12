-- manifest: **Anotações (bloco de notas em páginas e subpáginas).** `notes_pages`: árvore por organização (`parent_id`, `position` numeric), blocos do editor da Estratégia em `blocks`, `visible_to_client` por página e lixeira (`deleted_at`). Trigger de guarda impede pai de outra organização, ciclo e profundidade acima de 12. RLS: a agência (manager+) lê e escreve tudo; os demais membros leem só o visível ao cliente e fora da lixeira.

-- ============================================================================
-- 0686 — ANOTAÇÕES (bloco de notas em páginas e subpáginas)
--
-- Uma árvore de páginas por organização, escrita no mesmo editor de blocos da Estratégia. Serve
-- tanto à agência (na organização dela) quanto a cada cliente. Diferente das páginas de Marketing,
-- NÃO há rascunho/publicado: a página é salva sozinha e é a única versão. Quem escreve é a
-- agência (manager+); o cliente só lê as páginas marcadas `visible_to_client`. Apagar manda para
-- a lixeira (`deleted_at`); a exclusão definitiva é feita pela rota, com a chave do usuário.
-- ============================================================================

create table if not exists public.notes_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.notes_pages(id) on delete cascade,
  title text not null default '',
  icon text,
  position numeric not null default 0,
  blocks jsonb not null default '[]'::jsonb,
  visible_to_client boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notes_pages_title_check check (length(title) <= 200),
  constraint notes_pages_icon_check check (icon is null or length(icon) <= 16),
  constraint notes_pages_blocks_check
    check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 400000),
  constraint notes_pages_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists notes_pages_org_parent_idx
  on public.notes_pages (organization_id, parent_id, position);
create index if not exists notes_pages_org_deleted_idx
  on public.notes_pages (organization_id, deleted_at);

-- Guarda da árvore: o pai é da MESMA organização, não vira ciclo e a profundidade tem teto.
create or replace function public.fn_notes_pages_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_org uuid;
  v_ciclo boolean;
  v_profundidade int;
begin
  if new.parent_id is null then
    return new;
  end if;
  select organization_id into v_parent_org from public.notes_pages where id = new.parent_id;
  if v_parent_org is null or v_parent_org <> new.organization_id then
    raise exception 'notes_pages: página-mãe inválida' using errcode = '23514';
  end if;
  with recursive cadeia(id, parent_id, nivel) as (
    select id, parent_id, 1 from public.notes_pages where id = new.parent_id
    union all
    select p.id, p.parent_id, c.nivel + 1
      from public.notes_pages p join cadeia c on p.id = c.parent_id
     where c.nivel < 50
  )
  select coalesce(bool_or(id = new.id), false), coalesce(max(nivel), 0)
    into v_ciclo, v_profundidade
    from cadeia;
  if v_ciclo then
    raise exception 'notes_pages: uma página não pode ficar dentro dela mesma' using errcode = '23514';
  end if;
  if v_profundidade >= 12 then
    raise exception 'notes_pages: subpáginas demais, uma dentro da outra' using errcode = '23514';
  end if;
  return new;
end $$;

revoke execute on function public.fn_notes_pages_guard() from public, anon;

drop trigger if exists notes_pages_guard on public.notes_pages;
create trigger notes_pages_guard
  before insert or update of parent_id on public.notes_pages
  for each row execute function public.fn_notes_pages_guard();

drop trigger if exists notes_pages_updated_at on public.notes_pages;
create trigger notes_pages_updated_at
  before update on public.notes_pages
  for each row execute function public.fn_set_updated_at();

alter table public.notes_pages enable row level security;

-- Ler: a agência (manager+) lê tudo, lixeira incluída; os demais membros, só o marcado como
-- visível ao cliente e fora da lixeira. O super-admin da plataforma lê todas as organizações.
drop policy if exists notes_pages_select on public.notes_pages;
create policy notes_pages_select on public.notes_pages
  for select using (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and (
        public.fn_role_at_least(organization_id, 'manager')
        or (visible_to_client and deleted_at is null)
      )
    )
  );

-- Escrever: só a agência.
drop policy if exists notes_pages_write on public.notes_pages;
create policy notes_pages_write on public.notes_pages
  using (
    public.fn_is_platform_admin_full()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  )
  with check (
    public.fn_is_platform_admin_full()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  );

comment on table public.notes_pages is
  'Anotações: árvore de páginas por organização, em blocos. Sem rascunho/publicado; visible_to_client libera a página ao cliente.';
