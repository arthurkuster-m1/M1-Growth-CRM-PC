-- manifest: **Passo 5 do modelo CRM: visualizações com dono.** Cada pessoa cria e edita as SUAS visualizações (`crm_saved_views.created_by`); a visualização de outra pessoa não se edita nem se apaga (só a visualização sem dono, de antes, é de manager+); e qualquer pessoa pode ARQUIVAR PARA SI a visualização de outra (`crm_saved_view_arquivadas`, só para quem arquivou).

create table if not exists public.crm_saved_view_arquivadas (
  user_id uuid not null references auth.users(id) on delete cascade,
  view_id uuid not null references public.crm_saved_views(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, view_id)
);

create index if not exists crm_saved_view_arquivadas_org_idx
  on public.crm_saved_view_arquivadas (organization_id, user_id);

alter table public.crm_saved_view_arquivadas enable row level security;

drop policy if exists crm_saved_view_arquivadas_own on public.crm_saved_view_arquivadas;
create policy crm_saved_view_arquivadas_own on public.crm_saved_view_arquivadas
  for all
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()))
  with check (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));

revoke all on public.crm_saved_view_arquivadas from anon;
grant select, insert, delete on public.crm_saved_view_arquivadas to authenticated;

notify pgrst, 'reload schema';
