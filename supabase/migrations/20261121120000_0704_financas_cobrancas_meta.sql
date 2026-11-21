-- manifest: **Finanças: cobranças da Meta no cartão.** `fin_orcamento_config.conta_meta_id` marca qual cartão a Meta cobra. `fin_cobrancas_meta` guarda cada cobrança lida da plataforma de anúncios (id da Meta, data/hora, valor cobrado, moeda, estado paga/recusada/estornada, JSON cru) — única por empresa e id; escrita só pelo servidor (service role). Cobrança paga vira UMA saída no cartão (`origem = 'meta'`, `ref_externa = 'meta:<id>'`, categoria "Tráfego pago", fatura pelo fechamento do cartão); estorno vira entrada no mesmo cartão; recusada não vira lançamento (nada saiu) — vira alerta. `fin_meta_estado` guarda a última leitura, o último erro e a situação da conta de anúncio (para a faixa de alerta). Gatilho só escreve em `fin_transactions` (nada de HTTP). `fn_fin_importar_cobrancas_meta(org)` refaz os lançamentos das cobranças já guardadas (usada ao ligar o cartão). Aditiva e idempotente.

-- 0704 — FINANÇAS: COBRANÇAS DA META NO CARTÃO
--
-- O valor lançado é o que a Meta COBROU (com imposto), não o gasto das campanhas. A cobrança é a fonte
-- da verdade: valor, data e tipo vêm dela; a empresa ajusta só categoria e anotação.

alter table public.fin_orcamento_config
  add column if not exists conta_meta_id uuid references public.fin_accounts(id) on delete set null;
comment on column public.fin_orcamento_config.conta_meta_id is
  'Cartão que a Meta cobra (0704). As cobranças lidas da plataforma viram saídas neste cartão.';

create table if not exists public.fin_cobrancas_meta (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Identificador da cobrança na plataforma (ou chave estável montada a partir do evento).
  meta_id text not null check (char_length(meta_id) between 1 and 200),
  conta_anuncio text not null,
  cobrada_em timestamptz not null,
  -- Centavos. Null = a plataforma não informou o valor (não vira lançamento; aparece para conferir).
  valor_cents bigint check (valor_cents is null or valor_cents >= 0),
  moeda text not null default 'BRL',
  estado text not null check (estado in ('paga', 'recusada', 'estornada')),
  tipo_evento text,
  bruto jsonb not null default '{}'::jsonb check (pg_column_size(bruto) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, meta_id)
);
create index if not exists fin_cobrancas_meta_org_data_idx
  on public.fin_cobrancas_meta (organization_id, cobrada_em desc);

create table if not exists public.fin_meta_estado (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  ultima_leitura_em timestamptz,
  ultimo_erro text check (ultimo_erro is null or char_length(ultimo_erro) <= 300),
  -- `account_status` da conta de anúncio (1 ativa, 2 desativada, 3 pagamento pendente, 9 carência…).
  conta_status integer,
  conta_status_em timestamptz,
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['fin_cobrancas_meta', 'fin_meta_estado'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format($p$create policy %I on public.%I for select using (
      ((organization_id in (select public.fn_user_org_ids()))
       and public.fn_role_at_least(organization_id, 'manager'))
      or public.fn_is_platform_admin())$p$, t || '_select', t);
    -- Sem policy de escrita: quem grava é o servidor (service role), nunca o navegador.
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke all on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Uma cobrança → o lançamento dela (ou nenhum).
create or replace function public.fn_fin_sincronizar_cobranca_meta(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record; v_conta uuid; v_cat uuid; v_ref text; v_tipo text; v_data date;
begin
  select * into c from public.fin_cobrancas_meta where id = p_id;
  if not found then return; end if;
  v_ref := 'meta:' || c.meta_id;

  select conta_meta_id into v_conta from public.fin_orcamento_config where organization_id = c.organization_id;
  if v_conta is not null and not exists (
       select 1 from public.fin_accounts
        where id = v_conta and organization_id = c.organization_id and tipo = 'cartao') then
    v_conta := null;
  end if;

  -- Recusada, sem valor, em outra moeda ou sem cartão ligado: nada saiu do cartão (ou não dá para lançar).
  if c.estado = 'recusada' or c.valor_cents is null or c.valor_cents <= 0
     or upper(c.moeda) <> 'BRL' or v_conta is null then
    delete from public.fin_transactions
     where organization_id = c.organization_id and ref_externa = v_ref and origem = 'meta';
    return;
  end if;

  v_tipo := case when c.estado = 'estornada' then 'entrada' else 'saida' end;
  v_data := (c.cobrada_em at time zone 'America/Sao_Paulo')::date;
  if v_tipo = 'saida' then
    select id into v_cat from public.fin_categories
     where organization_id = c.organization_id and tipo = 'saida' and nome = 'Tráfego pago' limit 1;
  end if;

  insert into public.fin_transactions
    (organization_id, data, valor_cents, tipo, status, category_id, account_id, nota, origem, ref_externa)
  values
    (c.organization_id, v_data, c.valor_cents, v_tipo, 'pago', v_cat, v_conta,
     case when v_tipo = 'entrada' then 'Meta Ads — estorno' else 'Meta Ads — cobrança no cartão' end,
     'meta', v_ref)
  on conflict (organization_id, ref_externa) where ref_externa is not null
  do update set
    valor_cents = excluded.valor_cents,
    data = excluded.data,
    tipo = excluded.tipo,
    status = excluded.status,
    account_id = excluded.account_id,
    -- mudou a data ou o cartão: a fatura é recalculada pelo gatilho do cartão
    fatura_mes = case when public.fin_transactions.data is distinct from excluded.data
                        or public.fin_transactions.account_id is distinct from excluded.account_id
                      then null else public.fin_transactions.fatura_mes end;
end $$;
revoke execute on function public.fn_fin_sincronizar_cobranca_meta(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_sincronizar_cobranca_meta(uuid) to service_role;

create or replace function public.fn_fin_trg_cobranca_meta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.fin_transactions
     where organization_id = old.organization_id and ref_externa = 'meta:' || old.meta_id and origem = 'meta';
    return null;
  end if;
  perform public.fn_fin_sincronizar_cobranca_meta(new.id);
  return null;
end $$;
revoke execute on function public.fn_fin_trg_cobranca_meta() from public, anon, authenticated;

drop trigger if exists trg_fin_sync_cobranca_meta on public.fin_cobrancas_meta;
create trigger trg_fin_sync_cobranca_meta
  after insert or update of valor_cents, cobrada_em, estado, moeda on public.fin_cobrancas_meta
  for each row execute function public.fn_fin_trg_cobranca_meta();
drop trigger if exists trg_fin_sync_cobranca_meta_apagada on public.fin_cobrancas_meta;
create trigger trg_fin_sync_cobranca_meta_apagada
  after delete on public.fin_cobrancas_meta
  for each row execute function public.fn_fin_trg_cobranca_meta();

-- Refaz os lançamentos das cobranças já guardadas (ao ligar/trocar o cartão da Meta). Idempotente.
create or replace function public.fn_fin_importar_cobrancas_meta(p_org uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.fin_cobrancas_meta where organization_id = p_org order by cobrada_em loop
    perform public.fn_fin_sincronizar_cobranca_meta(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.fn_fin_importar_cobrancas_meta(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_importar_cobrancas_meta(uuid) to service_role;

notify pgrst, 'reload schema';
