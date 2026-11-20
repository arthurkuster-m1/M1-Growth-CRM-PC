-- manifest: **Finanças (base).** Tabelas `fin_*` por empresa, portadas do app de Finanças da Família Kuster: contas (corrente, investida, bem, cartão com fechamento/vencimento), grupos e categorias, lançamentos (entrada/saída/transferência; pendente/pago/cancelado; fatura do cartão; parcelas; `origem` e `ref_externa` únicos para não duplicar o que vem das vendas), saldo de abertura, conferência de saldo e de fatura, teto e meta do mês. Dinheiro em centavos. RLS: só gerente ou acima (e a plataforma) lê e escreve. Funções de saldo/patrimônio recebem a empresa e filtram por ela. Semente de categorias de empresa por `fn_fin_semear`. Aditiva e idempotente.

-- 0700 — FINANÇAS (BASE)
--
-- Por que tabelas novas e não `financial_entries`: aquela é o livro-razão das comandas e não tem
-- transferência, cartão nem fatura. As Finanças do CRM nascem das VENDAS (`crm_sale_payments`, na
-- 0701) e dos lançamentos manuais, e usam o modelo do app da família, já provado em uso.

-- ── 1. Contas (corrente, investida, emprestada, bem, cartão) ───────────────────────────────────
create table if not exists public.fin_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  tipo text not null check (tipo in ('corrente', 'investida', 'emprestada', 'bem', 'cartao')),
  ativa boolean not null default true,
  ordem smallint not null default 0,
  -- Rendimento: "% do CDI" ou "% ao ano" (taxa fixa que a pessoa informa).
  rendimento_pct numeric(7, 4) check (rendimento_pct is null or (rendimento_pct > 0 and rendimento_pct <= 1000)),
  rendimento_base text check (rendimento_base in ('ano', 'cdi')),
  -- Cartão: compra depois do fechamento cai na fatura seguinte; a fatura é nomeada pelo mês em que é PAGA.
  dia_fechamento smallint check (dia_fechamento between 1 and 31),
  dia_vencimento smallint check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid references public.fin_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, nome),
  constraint fin_accounts_rendimento_par_check check ((rendimento_pct is null) = (rendimento_base is null))
);
create index if not exists fin_accounts_org_idx on public.fin_accounts (organization_id, ativa, ordem);

-- ── 2. Grupos e categorias ──────────────────────────────────────────────────────────────────────
-- O grupo "Sistema" (ajustes automáticos da conferência de saldo) é marcado `sistema` e some da tela:
-- não entra em gráficos nem em totais de consumo.
create table if not exists public.fin_category_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  ordem integer not null default 0,
  sistema boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists fin_category_groups_nome_uk
  on public.fin_category_groups (organization_id, lower(btrim(nome)));

create table if not exists public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  group_id uuid references public.fin_category_groups(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  -- Só como META DE GANHO do mês (categoria de entrada); o único orçamento de gastos é o teto do mês.
  orcamento_mensal_cents bigint not null default 0 check (orcamento_mensal_cents >= 0),
  ativa boolean not null default true,
  ordem integer not null default 0,
  cor smallint check (cor between 1 and 10),
  -- Criada pelo sistema (ex.: "Vendas"): não se apaga nem se renomeia.
  sistema boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, tipo, nome)
);
create index if not exists fin_categories_group_idx on public.fin_categories (group_id);

-- ── 3. Lançamentos ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data date not null default current_date,
  valor_cents bigint not null check (valor_cents > 0),
  tipo text not null check (tipo in ('entrada', 'saida', 'transferencia')),
  -- pendente = previsto (não mexe no saldo); pago; cancelado = fica no histórico e não conta.
  status text not null default 'pago' check (status in ('pendente', 'pago', 'cancelado')),
  category_id uuid references public.fin_categories(id) on delete restrict,
  account_id uuid references public.fin_accounts(id) on delete restrict,
  -- Transferência: sai de account_id, entra em account_destino_id; sem categoria.
  account_destino_id uuid references public.fin_accounts(id) on delete restrict,
  nota text,
  -- Mês (dia 1) em que a fatura do cartão é PAGA. Só para lançamento em conta-cartão.
  fatura_mes date check (fatura_mes is null or fatura_mes = date_trunc('month', fatura_mes)::date),
  parcela_atual smallint,
  parcela_total smallint,
  -- De onde veio: à mão, de uma venda do CRM, da cobrança da Meta ou de planilha/CSV.
  origem text not null default 'manual' check (origem in ('manual', 'venda', 'meta', 'importacao')),
  -- Identificador do lado de fora (ex.: 'venda:<id da parcela>'): único por empresa, não duplica.
  ref_externa text,
  import_hash text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fin_transactions_parcela_par_check check ((parcela_atual is null) = (parcela_total is null)),
  constraint fin_transactions_transferencia_check check (
    (tipo = 'transferencia' and account_id is not null and account_destino_id is not null
       and account_id <> account_destino_id and category_id is null)
    or (tipo <> 'transferencia' and account_destino_id is null)
  )
);
create index if not exists fin_transactions_org_data_idx on public.fin_transactions (organization_id, data desc);
create index if not exists fin_transactions_cat_idx on public.fin_transactions (category_id);
create index if not exists fin_transactions_account_idx on public.fin_transactions (account_id, data);
create index if not exists fin_transactions_destino_idx on public.fin_transactions (account_destino_id)
  where account_destino_id is not null;
create index if not exists fin_transactions_fatura_idx on public.fin_transactions (account_id, fatura_mes)
  where fatura_mes is not null;
create unique index if not exists fin_transactions_ref_externa_uk
  on public.fin_transactions (organization_id, ref_externa) where ref_externa is not null;
create unique index if not exists fin_transactions_import_hash_uk
  on public.fin_transactions (organization_id, import_hash) where import_hash is not null;

drop trigger if exists trg_fin_transactions_updated_at on public.fin_transactions;
create trigger trg_fin_transactions_updated_at
  before update on public.fin_transactions
  for each row execute function public.fn_set_updated_at();

-- A fatura de um lançamento de cartão e a COERÊNCIA DE EMPRESA: conta, destino e categoria têm de ser
-- da mesma empresa do lançamento (a chave estrangeira sozinha deixaria apontar para a de outra).
-- Fatura: 1) a compra cai no ciclo que fecha no próprio mês (dia <= fechamento) ou no seguinte;
-- 2) a fatura é paga no mês do fechamento se o vencimento é depois dele (fecha 20, vence 27), ou no
-- mês seguinte se o vencimento é até o dia do fechamento (fecha 28, vence 5). Editável à mão.
create or replace function public.fn_fin_tx_fatura() returns trigger
language plpgsql set search_path = '' as $$
declare a record; ciclo date; org_ok boolean;
begin
  select tipo, dia_fechamento, dia_vencimento, organization_id into a
    from public.fin_accounts where id = new.account_id;
  if new.account_id is not null and (a.organization_id is distinct from new.organization_id) then
    raise exception 'fin_transactions: a conta não é desta empresa' using errcode = '23514';
  end if;
  if new.account_destino_id is not null then
    select exists (select 1 from public.fin_accounts
                    where id = new.account_destino_id and organization_id = new.organization_id) into org_ok;
    if not org_ok then
      raise exception 'fin_transactions: a conta de destino não é desta empresa' using errcode = '23514';
    end if;
  end if;
  if new.category_id is not null then
    select exists (select 1 from public.fin_categories
                    where id = new.category_id and organization_id = new.organization_id) into org_ok;
    if not org_ok then
      raise exception 'fin_transactions: a categoria não é desta empresa' using errcode = '23514';
    end if;
  end if;

  if a.tipo = 'cartao' and new.tipo <> 'transferencia' then
    if new.fatura_mes is null then
      ciclo := date_trunc('month',
        case when extract(day from new.data) > coalesce(a.dia_fechamento, 31)
             then new.data + interval '1 month' else new.data end)::date;
      new.fatura_mes := case
        when a.dia_vencimento is not null and a.dia_fechamento is not null and a.dia_vencimento <= a.dia_fechamento
          then (ciclo + interval '1 month')::date
        else ciclo end;
    end if;
  else
    new.fatura_mes := null;
  end if;
  return new;
end $$;
revoke execute on function public.fn_fin_tx_fatura() from public, anon, authenticated;
drop trigger if exists trg_fin_transactions_fatura on public.fin_transactions;
create trigger trg_fin_transactions_fatura
  before insert or update of organization_id, account_id, account_destino_id, category_id, tipo, data, fatura_mes
  on public.fin_transactions
  for each row execute function public.fn_fin_tx_fatura();

comment on column public.fin_transactions.fatura_mes is
  'Mês (dia 1) em que a fatura do cartão é PAGA, isto é, quando o dinheiro sai do caixa. Só para lançamentos em conta-cartão.';
comment on column public.fin_transactions.ref_externa is
  'Chave do lado de fora (venda:<id da parcela>, meta:<id da cobrança>): única por empresa, impede duplicar o que entra sozinho.';

-- ── 4. Saldo de abertura, conferência de saldo e de fatura ───────────────────────────────────────
create table if not exists public.fin_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  mes date not null check (mes = date_trunc('month', mes)::date),
  saldo_cents bigint not null,
  nota text,
  created_at timestamptz not null default now(),
  unique (account_id, mes)
);
comment on table public.fin_balance_snapshots is
  'Saldo de ABERTURA da conta no mês (mes = dia 1). Sem linha, o mês herda o fechamento do anterior; com linha, ela manda (é a edição manual).';

create table if not exists public.fin_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  data date not null default current_date,
  saldo_sistema_cents bigint not null,
  saldo_real_cents bigint not null,
  diferenca_cents bigint generated always as (saldo_real_cents - saldo_sistema_cents) stored,
  destino text not null check (destino in ('rendimento', 'ajuste', 'ignorar')),
  transaction_id uuid references public.fin_transactions(id) on delete set null,
  nota text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists fin_reconciliations_account_idx on public.fin_reconciliations (account_id, data desc);

create table if not exists public.fin_invoice_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references public.fin_accounts(id) on delete cascade,
  mes date not null check (mes = date_trunc('month', mes)::date),
  total_banco_cents bigint not null check (total_banco_cents >= 0),
  nota text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, mes)
);
drop trigger if exists trg_fin_invoice_checks_updated_at on public.fin_invoice_checks;
create trigger trg_fin_invoice_checks_updated_at
  before update on public.fin_invoice_checks
  for each row execute function public.fn_set_updated_at();

-- ── 5. Teto de gastos e meta de ganhos do mês (padrão + exceção por mês) ────────────────────────
create table if not exists public.fin_orcamento_config (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  teto_padrao_cents bigint not null default 0 check (teto_padrao_cents >= 0),
  meta_padrao_cents bigint not null default 0 check (meta_padrao_cents >= 0),
  -- Conta que recebe as vendas quando a forma de pagamento não indica nenhuma (0701).
  conta_vendas_id uuid references public.fin_accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.fin_teto_mensal (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  valor_cents bigint not null check (valor_cents >= 0),
  primary key (organization_id, mes)
);
create table if not exists public.fin_meta_mensal (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  valor_cents bigint not null check (valor_cents >= 0),
  primary key (organization_id, mes)
);

-- ── 6. RLS: só gerente ou acima (e a plataforma) lê e escreve ───────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'fin_accounts', 'fin_category_groups', 'fin_categories', 'fin_transactions',
    'fin_balance_snapshots', 'fin_reconciliations', 'fin_invoice_checks',
    'fin_orcamento_config', 'fin_teto_mensal', 'fin_meta_mensal'
  ] loop
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

-- ── 7. Saldo por conta, fluxo mensal e totais de fatura (visões da empresa; a RLS vale) ──────────
-- Saldo atual: abertura (último saldo de abertura até o mês corrente) + movimentos pagos desde então, até hoje.
-- Entrada soma; saída e transferência-origem subtraem; transferência-destino soma.
create or replace view public.fin_account_balances with (security_invoker = true) as
select a.id as account_id, a.organization_id, s.mes as base_mes,
       coalesce(s.saldo_cents, 0) as base_cents,
       coalesce(s.saldo_cents, 0) + coalesce((
         select sum(m.delta) from (
           select t.valor_cents * case when t.tipo = 'entrada' then 1 else -1 end as delta, t.data
             from public.fin_transactions t where t.account_id = a.id and t.status = 'pago'
           union all
           select t.valor_cents, t.data
             from public.fin_transactions t where t.account_destino_id = a.id and t.status = 'pago'
         ) m
         where m.data <= current_date and (s.mes is null or m.data >= s.mes)
       ), 0) as saldo_atual_cents
from public.fin_accounts a
left join lateral (
  select b.mes, b.saldo_cents from public.fin_balance_snapshots b
   where b.account_id = a.id and b.mes <= date_trunc('month', current_date)::date
   order by b.mes desc limit 1
) s on true;

create or replace view public.fin_account_monthly_flow with (security_invoker = true) as
select t.organization_id, x.account_id, date_trunc('month', t.data)::date as mes,
       sum(x.delta) as movimento_cents,
       coalesce(sum(x.delta) filter (where x.kind = 'entrada'), 0) as entradas_cents,
       coalesce(-sum(x.delta) filter (where x.kind = 'saida'), 0) as saidas_cents,
       coalesce(sum(x.delta) filter (where x.kind = 'transf_in'), 0) as transf_entrada_cents,
       coalesce(-sum(x.delta) filter (where x.kind = 'transf_out'), 0) as transf_saida_cents
from public.fin_transactions t
cross join lateral (values
  (t.account_id, case when t.tipo = 'entrada' then t.valor_cents else -t.valor_cents end,
                 case when t.tipo = 'transferencia' then 'transf_out' else t.tipo end),
  (t.account_destino_id, t.valor_cents, 'transf_in')
) as x(account_id, delta, kind)
where t.status = 'pago' and x.account_id is not null
group by t.organization_id, x.account_id, date_trunc('month', t.data);

-- Total do app por cartão e fatura: compras (saídas) − créditos (entradas/estornos). Só 'pago' é o que o
-- banco já tem; previstos à parte.
create or replace view public.fin_invoice_totals with (security_invoker = true) as
select t.organization_id, t.account_id, t.fatura_mes as mes,
       coalesce(sum(t.valor_cents) filter (where t.status = 'pago' and t.tipo = 'saida'), 0) as compras_cents,
       coalesce(sum(t.valor_cents) filter (where t.status = 'pago' and t.tipo = 'entrada'), 0) as creditos_cents,
       coalesce(sum(t.valor_cents) filter (where t.status = 'pago' and t.tipo = 'saida'), 0)
         - coalesce(sum(t.valor_cents) filter (where t.status = 'pago' and t.tipo = 'entrada'), 0) as total_cents,
       coalesce(sum(case when t.tipo = 'saida' then t.valor_cents else -t.valor_cents end)
                filter (where t.status = 'pendente'), 0) as previstos_cents,
       count(*) filter (where t.status <> 'cancelado') as lancamentos
from public.fin_transactions t
where t.fatura_mes is not null
group by t.organization_id, t.account_id, t.fatura_mes;

revoke all on public.fin_account_balances, public.fin_account_monthly_flow, public.fin_invoice_totals from anon;
grant select on public.fin_account_balances, public.fin_account_monthly_flow, public.fin_invoice_totals to authenticated;

-- ── 8. Saldo de cada conta no INÍCIO de uma data, e patrimônio no fim de cada mês ────────────────
-- Recebem a EMPRESA e filtram por ela: quem pertence a mais de uma empresa nunca soma as duas.
create or replace function public.fin_saldos_na_data(p_org uuid, p_data date, p_previstos boolean default false)
returns table (account_id uuid, saldo_cents bigint)
language sql stable security invoker set search_path = public as $$
  select a.id,
         (coalesce(s.saldo_cents, 0) + coalesce((
           select sum(m.delta) from (
             select t.valor_cents * case when t.tipo = 'entrada' then 1 else -1 end as delta, t.data
               from public.fin_transactions t
              where t.account_id = a.id and (t.status = 'pago' or (p_previstos and t.status = 'pendente'))
             union all
             select t.valor_cents, t.data
               from public.fin_transactions t
              where t.account_destino_id = a.id and (t.status = 'pago' or (p_previstos and t.status = 'pendente'))
           ) m
           where m.data < p_data and (s.mes is null or m.data >= s.mes)
         ), 0))::bigint
    from public.fin_accounts a
    left join lateral (
      select b.mes, b.saldo_cents from public.fin_balance_snapshots b
       where b.account_id = a.id and b.mes <= p_data
       order by b.mes desc limit 1
    ) s on true
   where a.organization_id = p_org;
$$;
revoke execute on function public.fin_saldos_na_data(uuid, date, boolean) from public, anon;
grant execute on function public.fin_saldos_na_data(uuid, date, boolean) to authenticated, service_role;

-- `contas_cents` soma as contas que não são cartão; `cartoes_cents` soma os cartões (negativo = fatura em aberto).
create or replace function public.fin_patrimonio_mensal(p_org uuid, p_ate date, p_meses integer default 12)
returns table (mes date, contas_cents bigint, cartoes_cents bigint)
language sql stable security invoker set search_path = public as $$
  select m.mes,
         coalesce(sum(s.saldo_cents) filter (where a.tipo <> 'cartao'), 0)::bigint,
         coalesce(sum(s.saldo_cents) filter (where a.tipo = 'cartao'), 0)::bigint
    from (select (date_trunc('month', p_ate)::date - (g * interval '1 month'))::date as mes
            from generate_series(0, greatest(p_meses, 1) - 1) g) m
   cross join lateral public.fin_saldos_na_data(p_org, (m.mes + interval '1 month')::date, false) s
    join public.fin_accounts a on a.id = s.account_id
   group by m.mes
   order by m.mes;
$$;
revoke execute on function public.fin_patrimonio_mensal(uuid, date, integer) from public, anon;
grant execute on function public.fin_patrimonio_mensal(uuid, date, integer) to authenticated, service_role;

-- ── 9. Semente: o que uma empresa precisa para começar (idempotente) ─────────────────────────────
-- Só o servidor chama (service_role). Não mexe em nada que a empresa já tenha: só cria o que falta.
create or replace function public.fn_fin_semear(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g_receitas uuid; g_marketing uuid; g_operacao uuid; g_pessoas uuid; g_impostos uuid; g_sistema uuid;
begin
  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'fn_fin_semear: empresa inexistente' using errcode = '22023';
  end if;

  insert into public.fin_accounts (organization_id, nome, tipo, ordem)
  select p_org, 'Conta principal', 'corrente', 10
   where not exists (select 1 from public.fin_accounts where organization_id = p_org);

  insert into public.fin_category_groups (organization_id, nome, ordem, sistema) values
    (p_org, 'Receitas', 10, false), (p_org, 'Marketing', 20, false), (p_org, 'Operação', 30, false),
    (p_org, 'Pessoas', 40, false), (p_org, 'Impostos e taxas', 50, false), (p_org, 'Sistema', 1000, true)
  on conflict (organization_id, lower(btrim(nome))) do nothing;

  select id into g_receitas from public.fin_category_groups where organization_id = p_org and lower(nome) = 'receitas';
  select id into g_marketing from public.fin_category_groups where organization_id = p_org and lower(nome) = 'marketing';
  select id into g_operacao from public.fin_category_groups where organization_id = p_org and lower(nome) = 'operação';
  select id into g_pessoas from public.fin_category_groups where organization_id = p_org and lower(nome) = 'pessoas';
  select id into g_impostos from public.fin_category_groups where organization_id = p_org and lower(nome) = 'impostos e taxas';
  select id into g_sistema from public.fin_category_groups where organization_id = p_org and lower(nome) = 'sistema';

  insert into public.fin_categories (organization_id, nome, group_id, tipo, ordem, cor, sistema) values
    (p_org, 'Vendas', g_receitas, 'entrada', 10, 6, true),
    (p_org, 'Outras receitas', g_receitas, 'entrada', 20, 7, false),
    (p_org, 'Tráfego pago', g_marketing, 'saida', 10, 1, false),
    (p_org, 'Ferramentas e software', g_operacao, 'saida', 20, 2, false),
    (p_org, 'Aluguel e contas', g_operacao, 'saida', 30, 3, false),
    (p_org, 'Salários e pró-labore', g_pessoas, 'saida', 40, 4, false),
    (p_org, 'Comissões', g_pessoas, 'saida', 50, 5, false),
    (p_org, 'Impostos', g_impostos, 'saida', 60, 8, false),
    (p_org, 'Taxas de pagamento', g_impostos, 'saida', 70, 9, false),
    (p_org, 'Rendimentos', g_sistema, 'entrada', 900, null, true),
    (p_org, 'Ajuste de saldo', g_sistema, 'entrada', 910, null, true),
    (p_org, 'Ajuste de saldo', g_sistema, 'saida', 920, null, true)
  on conflict (organization_id, tipo, nome) do nothing;

  insert into public.fin_orcamento_config (organization_id) values (p_org)
  on conflict (organization_id) do nothing;
end $$;
revoke execute on function public.fn_fin_semear(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_semear(uuid) to service_role;

notify pgrst, 'reload schema';
