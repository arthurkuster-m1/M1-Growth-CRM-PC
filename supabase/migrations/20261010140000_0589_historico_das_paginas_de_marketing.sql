-- manifest: **Histórico das páginas de Marketing.** `marketing_page_snapshots` — retratos datados do conteúdo PUBLICADO de uma página (a agência salva quando houver mudança relevante). Leitura: toda a empresa (o cliente acompanha a evolução); criar e apagar: a partir de `manager`.

-- ============================================================================
-- 0589 — HISTÓRICO DAS PÁGINAS DE MARKETING
--
-- Cada retrato é uma cópia do que estava PUBLICADO naquele dia (nunca do rascunho), então o
-- cliente pode lê-los sem ver nada que a agência ainda não liberou. O salvamento é manual:
-- quem decide que "isto vale registrar" é a agência. O conteúdo é imutável — não há UPDATE,
-- só criar e apagar.
-- ============================================================================

create table if not exists public.marketing_page_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  page_id uuid not null references public.marketing_pages(id) on delete cascade,
  module_key text not null,
  note text not null default '',
  blocks jsonb not null,
  taken_by uuid references auth.users(id) on delete set null,
  taken_at timestamptz not null default now(),

  constraint marketing_page_snapshots_module_check check (module_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint marketing_page_snapshots_note_check check (length(note) <= 200),
  constraint marketing_page_snapshots_blocks_check
    check (jsonb_typeof(blocks) = 'array' and pg_column_size(blocks) <= 400000)
);

create index if not exists marketing_page_snapshots_page_idx
  on public.marketing_page_snapshots (page_id, taken_at desc);

alter table public.marketing_page_snapshots enable row level security;

drop policy if exists marketing_page_snapshots_select on public.marketing_page_snapshots;
create policy marketing_page_snapshots_select on public.marketing_page_snapshots
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists marketing_page_snapshots_insert on public.marketing_page_snapshots;
create policy marketing_page_snapshots_insert on public.marketing_page_snapshots
  for insert with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

drop policy if exists marketing_page_snapshots_delete on public.marketing_page_snapshots;
create policy marketing_page_snapshots_delete on public.marketing_page_snapshots
  for delete using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

revoke all on public.marketing_page_snapshots from anon;
grant select, insert, delete on public.marketing_page_snapshots to authenticated;

comment on table public.marketing_page_snapshots is
  'Retratos datados do conteúdo PUBLICADO de uma página de marketing (histórico que o cliente também lê). Salvos manualmente pela agência (manager+); imutáveis — só criar e apagar.';

notify pgrst, 'reload schema';
