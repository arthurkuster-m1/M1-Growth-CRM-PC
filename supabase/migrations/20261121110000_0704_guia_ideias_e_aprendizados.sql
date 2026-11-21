-- manifest: **Guia (G6) — ideias a partir dos resultados e aprendizados.** `guia_ideias`: cada sugestão do motor de regras (ou manual) com a evidência (os números), a ação, o estado (nova/aceita/dispensada/feita/medida), a foto dos números ao aceitar (`linha_de_base`), a data de medir de novo (`medir_em`), a foto depois (`resultado`) e o veredito humano; única por empresa+regra+alvo+janela, para a mesma ideia não voltar enquanto a janela vale. `guia_aprendizados`: o que fizemos, a hipótese, o resultado e se funcionou — alimenta o Dossiê. RLS: gerente ou acima. Sem função, sem trigger.

-- 0704 — GUIA: IDEIAS E APRENDIZADOS (docs/PLANO-GUIA-M1.md, G6)

-- ── 1. As ideias do que fazer ────────────────────────────────────────────────────────────────
create table if not exists public.guia_ideias (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- R01…R12 (ver docs/MAPA-DO-PROCESSO-M1.md §4) ou "manual".
  regra text not null check (regra ~ '^(R[0-9]{2}|manual)$'),
  origem text not null default 'regra' check (origem in ('regra', 'ia', 'manual')),
  alvo_tipo text not null check (alvo_tipo in ('campanha', 'passo', 'geral')),
  -- id da campanha (uuid em texto), id do passo ("P22") ou vazio (geral).
  alvo_id text not null default '' check (length(alvo_id) <= 64),
  -- A janela em que a regra vale (ex.: "2026-11-Q2"): a mesma ideia não volta dentro dela.
  janela text not null check (length(janela) between 1 and 32),
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  -- Os números que fizeram a regra disparar, em frases curtas. Nunca dado de lead.
  evidencia jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidencia) = 'array' and pg_column_size(evidencia) <= 4000),
  passo_relacionado text check (passo_relacionado is null or passo_relacionado ~ '^P[0-9]{2}(\.[0-9])?$'),
  acao_href text check (acao_href is null or length(acao_href) <= 300),
  prioridade smallint not null default 2 check (prioridade between 1 and 3),
  status text not null default 'nova' check (status in ('nova', 'aceita', 'dispensada', 'feita', 'medida')),
  motivo text check (motivo is null or length(motivo) <= 500),
  task_id uuid references public.crm_tasks(id) on delete set null,
  -- A foto dos números quando a ideia foi aceita, e quando medir de novo.
  linha_de_base jsonb check (linha_de_base is null or (jsonb_typeof(linha_de_base) = 'object' and pg_column_size(linha_de_base) <= 4000)),
  medir_em date,
  resultado jsonb check (resultado is null or (jsonb_typeof(resultado) = 'object' and pg_column_size(resultado) <= 4000)),
  veredito text check (veredito is null or veredito in ('funcionou', 'nao_funcionou', 'inconclusivo')),
  decidido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists guia_ideias_janela_uk
  on public.guia_ideias (organization_id, regra, alvo_id, janela);
create index if not exists guia_ideias_org_status_idx
  on public.guia_ideias (organization_id, status, prioridade, created_at desc);
create index if not exists guia_ideias_medir_idx
  on public.guia_ideias (medir_em) where status = 'aceita';

-- ── 2. Os aprendizados: o que funcionou e o que não funcionou ────────────────────────────────
create table if not exists public.guia_aprendizados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ideia_id uuid references public.guia_ideias(id) on delete set null,
  campanha_id uuid references public.demand_campaigns(id) on delete set null,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  hipotese text check (hipotese is null or length(hipotese) <= 1000),
  resultado text check (resultado is null or length(resultado) <= 2000),
  veredito text not null check (veredito in ('funcionou', 'nao_funcionou', 'inconclusivo')),
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists guia_aprendizados_org_idx
  on public.guia_aprendizados (organization_id, created_at desc);

-- ── 3. RLS: gerente ou acima (a agência entra por ser platform admin ou membro) ──────────────
do $$
declare t text;
begin
  foreach t in array array['guia_ideias', 'guia_aprendizados'] loop
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
