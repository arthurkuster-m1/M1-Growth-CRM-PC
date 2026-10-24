-- manifest: **Importações de leads dentro da campanha.** `demand_lead_imports` registra cada planilha importada numa campanha (arquivo, linhas, novos, já no CRM, inválidos, quem e quando) — junto das extrações, forma o registro de lotes da campanha; os leads importados nascem com a campanha e o arquivo na origem.
create table if not exists public.demand_lead_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  demand_campaign_id uuid not null references public.demand_campaigns(id) on delete cascade,
  file_name text not null default '',
  total_rows integer not null default 0,
  created_count integer not null default 0,
  existing_count integer not null default 0,
  invalid_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint demand_lead_imports_counts_check
    check (total_rows >= 0 and created_count >= 0 and existing_count >= 0 and invalid_count >= 0),
  constraint demand_lead_imports_file_check check (length(file_name) <= 300)
);

create index if not exists demand_lead_imports_campaign_idx
  on public.demand_lead_imports (organization_id, demand_campaign_id, created_at desc);

alter table public.demand_lead_imports enable row level security;

drop policy if exists demand_lead_imports_select on public.demand_lead_imports;
create policy demand_lead_imports_select on public.demand_lead_imports
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_lead_imports_write on public.demand_lead_imports;
create policy demand_lead_imports_write on public.demand_lead_imports
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

revoke all on public.demand_lead_imports from anon;
grant select, insert, update, delete on public.demand_lead_imports to authenticated;

comment on table public.demand_lead_imports is
  'Planilhas de leads importadas numa campanha de demanda: o registro de cada lote (arquivo, linhas, novos, já no CRM, inválidos). Lido pela empresa toda; escrito a partir de manager.';

notify pgrst, 'reload schema';
