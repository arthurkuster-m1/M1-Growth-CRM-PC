-- manifest: **Finanças: as vendas viram entradas sozinhas.** Cada parcela de venda (`crm_sale_payments`) vira UM lançamento de entrada em `fin_transactions` (`origem = 'venda'`, `ref_externa = 'venda:<id da parcela>'`, único por empresa): recebida → pago na data do recebimento; prevista → pendente no vencimento; cancelada, ou prevista de venda perdida → cancelado. Acompanha mudança de valor, data e status por gatilho (o gatilho só escreve em `fin_transactions`; nada de HTTP) e apagar a parcela apaga a entrada. Cai na conta das vendas (`fin_orcamento_config.conta_vendas_id`, senão a primeira conta corrente) e na categoria "Vendas". Função `fn_fin_importar_vendas(org)` traz as vendas que já existem (idempotente) e roda para toda empresa que já abriu as Finanças; `fn_fin_semear` passa a chamá-la. Aditiva e idempotente.

-- 0701 — FINANÇAS: AS VENDAS VIRAM ENTRADAS
--
-- A venda continua sendo a fonte da verdade: valor, data e situação vêm da parcela. O que a empresa
-- pode ajustar no lançamento é a conta, a categoria e a anotação (a sincronização não os sobrescreve).

create or replace function public.fn_fin_sincronizar_parcela(p_parcela uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p record; l record; v_ref text; v_conta uuid; v_cat uuid; v_status text; v_data date; v_nota text; v_n integer;
begin
  v_ref := 'venda:' || p_parcela::text;
  select * into p from public.crm_sale_payments where id = p_parcela;
  if not found then
    delete from public.fin_transactions where ref_externa = v_ref and origem = 'venda';
    return;
  end if;

  -- Só empresas que já abriram as Finanças (têm conta): para as outras, a importação faz tudo na abertura.
  if not exists (select 1 from public.fin_accounts where organization_id = p.organization_id) then
    return;
  end if;
  -- Parcela sem valor não é dinheiro (o lançamento exige valor > 0): some a entrada que existia.
  if p.amount_cents is null or p.amount_cents <= 0 then
    delete from public.fin_transactions
     where organization_id = p.organization_id and ref_externa = v_ref and origem = 'venda';
    return;
  end if;

  select ld.status as status,
         coalesce(nullif(btrim(c.display_name), ''), nullif(btrim(c.name), ''), nullif(btrim(c.phone_number), ''), 'Cliente') as cliente
    into l
    from public.crm_leads ld
    left join public.contacts c on c.id = ld.contact_id
   where ld.id = p.lead_id and ld.organization_id = p.organization_id;

  v_status := case
    when p.status = 'recebida' then 'pago'
    when p.status = 'prevista' and coalesce(l.status, 'open') <> 'lost' then 'pendente'
    else 'cancelado' end;
  v_data := case when p.status = 'recebida' then coalesce(p.paid_on, p.due_on) else p.due_on end;

  select conta_vendas_id into v_conta from public.fin_orcamento_config where organization_id = p.organization_id;
  if v_conta is not null and not exists (
       select 1 from public.fin_accounts where id = v_conta and organization_id = p.organization_id and tipo <> 'cartao') then
    v_conta := null;
  end if;
  if v_conta is null then
    select id into v_conta from public.fin_accounts
     where organization_id = p.organization_id and tipo = 'corrente' and ativa
     order by ordem, created_at limit 1;
  end if;
  if v_conta is null then return; end if;

  select id into v_cat from public.fin_categories
   where organization_id = p.organization_id and tipo = 'entrada' and nome = 'Vendas' limit 1;

  select count(*) into v_n from public.crm_sale_payments where lead_id = p.lead_id and status <> 'cancelada';
  v_nota := 'Venda — ' || coalesce(l.cliente, 'Cliente') ||
            case when v_n > 1 then ' · parcela ' || p.number::text || '/' || v_n::text else '' end;

  insert into public.fin_transactions
    (organization_id, data, valor_cents, tipo, status, category_id, account_id, nota, origem, ref_externa)
  values
    (p.organization_id, v_data, p.amount_cents, 'entrada', v_status, v_cat, v_conta, v_nota, 'venda', v_ref)
  on conflict (organization_id, ref_externa) where ref_externa is not null
  do update set valor_cents = excluded.valor_cents, data = excluded.data, status = excluded.status;
end $$;
revoke execute on function public.fn_fin_sincronizar_parcela(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_sincronizar_parcela(uuid) to service_role;

create or replace function public.fn_fin_trg_parcela() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.fin_transactions
     where organization_id = old.organization_id and ref_externa = 'venda:' || old.id::text and origem = 'venda';
    return null;
  end if;
  perform public.fn_fin_sincronizar_parcela(new.id);
  return null;
end $$;
revoke execute on function public.fn_fin_trg_parcela() from public, anon, authenticated;

drop trigger if exists trg_fin_sync_parcela on public.crm_sale_payments;
create trigger trg_fin_sync_parcela
  after insert or update of amount_cents, due_on, paid_on, status, lead_id on public.crm_sale_payments
  for each row execute function public.fn_fin_trg_parcela();
drop trigger if exists trg_fin_sync_parcela_apagada on public.crm_sale_payments;
create trigger trg_fin_sync_parcela_apagada
  after delete on public.crm_sale_payments
  for each row execute function public.fn_fin_trg_parcela();

-- Venda perdida (ou reaberta): as parcelas previstas dela mudam de situação.
create or replace function public.fn_fin_trg_lead_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select id from public.crm_sale_payments where lead_id = new.id and status = 'prevista' loop
      perform public.fn_fin_sincronizar_parcela(r.id);
    end loop;
  end if;
  return null;
end $$;
revoke execute on function public.fn_fin_trg_lead_status() from public, anon, authenticated;

drop trigger if exists trg_fin_sync_lead_status on public.crm_leads;
create trigger trg_fin_sync_lead_status
  after update of status on public.crm_leads
  for each row execute function public.fn_fin_trg_lead_status();

-- Traz para as Finanças as vendas que já existem (idempotente: a chave `venda:<id>` não duplica).
create or replace function public.fn_fin_importar_vendas(p_org uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.crm_sale_payments where organization_id = p_org order by due_on loop
    perform public.fn_fin_sincronizar_parcela(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.fn_fin_importar_vendas(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_importar_vendas(uuid) to service_role;

-- A semente agora termina trazendo as vendas (a empresa abre as Finanças e já vê as entradas).
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

  perform public.fn_fin_importar_vendas(p_org);
end $$;
revoke execute on function public.fn_fin_semear(uuid) from public, anon, authenticated;
grant execute on function public.fn_fin_semear(uuid) to service_role;

-- Quem já abriu as Finanças (tem conta) recebe as vendas agora.
do $$
declare o record;
begin
  for o in select distinct organization_id from public.fin_accounts loop
    perform public.fn_fin_importar_vendas(o.organization_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
