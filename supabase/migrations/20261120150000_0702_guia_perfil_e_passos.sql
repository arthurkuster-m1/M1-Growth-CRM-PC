-- manifest: **Guia (G2).** `guia_perfil` (nicho, como vende, objetivo, ticket, meta de leads e links da empresa — uma linha por empresa) e `guia_passos` (só as EXCEÇÕES do mapa de marketing: passo marcado à mão como feito/dispensado, com motivo, e a tarefa criada a partir dele). O diagnóstico em si é calculado em código, não guardado. RLS: só gerente ou acima da empresa (e a agência). Sem função nova, sem trigger.

-- 0702 — GUIA: PERFIL DO CLIENTE E MARCAÇÕES À MÃO (docs/PLANO-GUIA-M1.md, G2)
--
-- O catálogo do mapa e o diagnóstico moram em código (lib/guia/) e são recalculados a cada leitura.
-- O banco guarda só o que o código não sabe: quem é o cliente (perfil) e o que alguém decidiu à mão.

-- ── 1. O perfil do cliente (uma linha por empresa) ────────────────────────────────────────────
create table if not exists public.guia_perfil (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  nicho text not null check (nicho in ('clinica', 'servico', 'imobiliaria', 'loja', 'infoproduto')),
  -- Como vende; pode ser mais de um. Vocabulário fechado: ver MODELOS_DE_VENDA em lib/guia/tipos.ts.
  modelos text[] not null default array[]::text[]
    check (modelos <@ array['agendamento', 'whatsapp', 'checkout', 'lancamento']::text[]),
  ja_tem_oferta boolean not null default false,
  objetivo text check (objetivo in ('mais_leads', 'leads_melhores', 'mais_vendas', 'reativar_base')),
  ticket_medio_cents bigint check (ticket_medio_cents is null or ticket_medio_cents >= 0),
  meta_leads_mes integer check (meta_leads_mes is null or meta_leads_mes >= 0),
  site_url text check (site_url is null or length(site_url) <= 500),
  instagram_url text check (instagram_url is null or length(instagram_url) <= 500),
  google_negocio_url text check (google_negocio_url is null or length(google_negocio_url) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 2. As marcações à mão, por passo do mapa ──────────────────────────────────────────────────
-- Só existe linha quando alguém marcou algo ou criou uma tarefa a partir do passo. `estado` nulo =
-- só há tarefa ligada (o estado continua vindo do detector).
create table if not exists public.guia_passos (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  passo_id text not null check (passo_id ~ '^P[0-9]{2}(\.[0-9])?$'),
  estado text check (estado in ('feito', 'dispensado')),
  motivo text check (motivo is null or length(motivo) <= 500),
  marcado_em timestamptz,
  marcado_por uuid references auth.users(id) on delete set null,
  -- A tarefa criada a partir do passo; se a tarefa for apagada o vínculo some, o passo continua.
  task_id uuid references public.crm_tasks(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, passo_id),
  constraint guia_passos_marca_coerente check ((estado is null) = (marcado_em is null))
);

-- ── 3. RLS: gerente ou acima (a agência entra por ser platform admin ou membro) ───────────────
do $$
declare t text;
begin
  foreach t in array array['guia_perfil', 'guia_passos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$create policy %I on public.%I for select using (
      ((organization_id in (select public.fn_user_org_ids()))
       and public.fn_role_at_least(organization_id, 'manager'))
      or public.fn_is_platform_admin())$p$, t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I
      using (public.fn_is_platform_admin_full()
        or ((organization_id in (select public.fn_user_org_ids()))
            and public.fn_role_at_least(organization_id, 'manager')))
      with check (public.fn_is_platform_admin_full()
        or ((organization_id in (select public.fn_user_org_ids()))
            and public.fn_role_at_least(organization_id, 'manager')))$p$, t || '_write', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
