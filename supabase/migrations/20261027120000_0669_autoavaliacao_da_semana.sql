-- manifest: Autoavaliação semanal da agência no cronograma (nota 0–100 + anotações em tópicos), só gerente+ vê e escreve; uma por semana.
create table if not exists public.marketing_cronograma_autoavaliacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  semana_inicio date not null,
  nota smallint not null default 0,
  anotacoes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_cronograma_autoavaliacoes_nota_check check (nota between 0 and 100),
  constraint marketing_cronograma_autoavaliacoes_notas_check check (length(anotacoes) <= 2000),
  constraint marketing_cronograma_autoavaliacoes_semana_uk unique (organization_id, semana_inicio)
);

alter table public.marketing_cronograma_autoavaliacoes enable row level security;

drop policy if exists marketing_cronograma_autoavaliacoes_all on public.marketing_cronograma_autoavaliacoes;
create policy marketing_cronograma_autoavaliacoes_all on public.marketing_cronograma_autoavaliacoes
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

revoke all on public.marketing_cronograma_autoavaliacoes from anon;
