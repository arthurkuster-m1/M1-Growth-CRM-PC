-- manifest: **Taxas das formas de pagamento.** Cada empresa cadastra, no Financeiro, a taxa de Pix, Cartão de Crédito (uma taxa por número de parcelas), Cartão de Débito e das formas "Outra" que criar. Cada forma diz quem paga a taxa (o cliente final ou a empresa). A taxa paga pela empresa é custo variável e aparece no dashboard Business; o valor líquido é o recebido menos essa taxa. Só cria a tabela `payment_fee_settings` (aditiva).

create table if not exists public.payment_fee_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- 'pix' | 'cartao_credito' | 'cartao_debito' | 'outra:<slug>' (formas criadas pela empresa)
  forma text not null check (length(forma) between 2 and 80),
  -- nome mostrado; só obrigatório nas formas criadas pela empresa
  name text,
  is_custom boolean not null default false,
  is_active boolean not null default true,
  -- quem paga a taxa: o cliente final (soma no preço) ou a empresa (custo variável)
  payer text not null default 'company' check (payer in ('client', 'company')),
  -- taxa percentual em centésimos de ponto (299 = 2,99%)
  percent_bps integer not null default 0 check (percent_bps between 0 and 10000),
  -- taxa fixa por cobrança, em centavos
  fixed_cents integer not null default 0 check (fixed_cents >= 0),
  -- só cartão de crédito: {"1": 299, "2": 449, ...} taxa em bps por número de parcelas
  installment_bps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_fee_settings_org_forma_key
  on public.payment_fee_settings (organization_id, forma);

alter table public.payment_fee_settings enable row level security;

drop policy if exists tenant_isolation_payment_fee_settings_read on public.payment_fee_settings;
create policy tenant_isolation_payment_fee_settings_read on public.payment_fee_settings
  for select
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());

drop policy if exists tenant_isolation_payment_fee_settings_write on public.payment_fee_settings;
create policy tenant_isolation_payment_fee_settings_write on public.payment_fee_settings
  for all
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin_full())
  with check (
    public.fn_is_platform_admin_full()
    or (organization_id in (select public.fn_user_org_ids())
        and public.fn_role_at_least(organization_id, 'manager'))
  );

do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_touch_updated_at') then
    drop trigger if exists trg_payment_fee_settings_touch on public.payment_fee_settings;
    create trigger trg_payment_fee_settings_touch before update on public.payment_fee_settings
      for each row execute function public.fn_touch_updated_at();
  end if;
end $$;
