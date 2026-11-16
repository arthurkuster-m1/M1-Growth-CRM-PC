-- manifest: **Estratégia: páginas ocultas por empresa.** `marketing_estrategia_ocultos (organization_id, chave)`: o que a agência escondeu da aba Estratégia daquele cliente — uma fase inteira (`fase:diagnostico`), uma página (`estudo-de-persona`) ou um atalho (`atalho:estudo-de-persona`). Ocultar não apaga nada (o conteúdo fica e volta ao mostrar). Só o gerente (manager+) escreve; todo membro lê (a página precisa saber o que não desenhar). Produtos e ofertas nunca entra aqui (a rota recusa). Aditiva: tabela nova.

-- ============================================================================
-- 0691 — ESTRATÉGIA: PÁGINAS OCULTAS
--
-- Nem toda página da Estratégia faz sentido para todo cliente (depende do pacote contratado).
-- A agência oculta as que não servem — e traz de volta quando precisar. Quem decide o que NÃO se
-- desenha na aba é esta tabela; o conteúdo das páginas (marketing_pages) não é tocado ao ocultar.
-- ============================================================================

create table if not exists public.marketing_estrategia_ocultos (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chave text not null,
  hidden_by uuid references auth.users(id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (organization_id, chave),
  constraint marketing_estrategia_ocultos_chave_check
    check (chave ~ '^((fase|atalho):)?[a-z0-9][a-z0-9-]{0,63}$')
);

alter table public.marketing_estrategia_ocultos enable row level security;

drop policy if exists marketing_estrategia_ocultos_select on public.marketing_estrategia_ocultos;
create policy marketing_estrategia_ocultos_select on public.marketing_estrategia_ocultos
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists marketing_estrategia_ocultos_write on public.marketing_estrategia_ocultos;
create policy marketing_estrategia_ocultos_write on public.marketing_estrategia_ocultos
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

revoke all on public.marketing_estrategia_ocultos from anon;
grant select, insert, update, delete on public.marketing_estrategia_ocultos to authenticated;

comment on table public.marketing_estrategia_ocultos is
  'Estratégia: o que a agência escondeu da aba, por empresa (fase:*, página ou atalho:*).';
