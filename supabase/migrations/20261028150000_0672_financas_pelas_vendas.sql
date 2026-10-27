-- manifest: **Finanças pelas vendas.** Nova `fn_relatorio_financas(org, de, ate)`: entradas, saídas, saldo, a receber, vendas fechadas/canceladas, ticket médio, formas de pagamento, produtos, clientes e vendas por pessoa saem das oportunidades com parcela recebida (crm_leads + crm_sale_payments + crm_sale_items), não mais das comandas; lançamentos avulsos continuam entrando. Aditiva: `fn_relatorio_financeiro` (comandas) segue existindo.

-- Finanças pelas VENDAS. Uma venda é a oportunidade (crm_leads) com ao menos uma parcela
-- recebida; o dinheiro é o das parcelas (crm_sale_payments). Lançamentos avulsos
-- (financial_entries manual/recorrente) entram em entradas e saídas; os de comanda
-- (origin sale/reversal) NÃO entram — comanda não é mais fonte. Agrega NO BANCO: o PostgREST
-- corta em 1000 linhas. Invoker, para a RLS valer. Um bloco por moeda em `por_moeda`.
create or replace function public.fn_relatorio_financas(
  p_org uuid,
  p_de date,
  p_ate date
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with lancamentos as (
    select direction, amount_cents, currency as moeda
      from public.financial_entries
     where organization_id = p_org
       and status = 'paid'
       and origin in ('manual', 'recurring')
       and entry_date between p_de and p_ate
  ),
  parcelas as (
    select p.lead_id, p.amount_cents, p.status,
           coalesce(l.currency, 'BRL') as moeda,
           l.contact_id,
           coalesce(nullif(btrim(p.forma), ''), nullif(btrim(l.payment_method), ''), '') as forma
      from public.crm_sale_payments p
      join public.crm_leads l on l.id = p.lead_id and l.organization_id = p_org
     where p.organization_id = p_org
       and ((p.status = 'recebida' and p.paid_on between p_de and p_ate)
         or (p.status = 'prevista' and p.due_on between p_de and p_ate and l.status <> 'lost'))
  ),
  recebidas as (select * from parcelas where status = 'recebida'),
  previstas as (select * from parcelas where status = 'prevista'),
  vendas as (
    select l.id, l.owner_user_id, coalesce(l.currency, 'BRL') as moeda,
           coalesce(l.value_cents, 0) as valor_cents, l.status, l.closed_at,
           min(p.paid_on) filter (where p.status = 'recebida') as primeira
      from public.crm_leads l
      join public.crm_sale_payments p on p.lead_id = l.id and p.organization_id = p_org
     where l.organization_id = p_org
     group by l.id
    having bool_or(p.status = 'recebida')
  ),
  fechadas as (
    select * from vendas where status <> 'lost' and primeira between p_de and p_ate
  ),
  canceladas as (
    select * from vendas where status = 'lost' and closed_at::date between p_de and p_ate
  ),
  forma_por_moeda as (
    select r.moeda,
           coalesce(nullif(pf.name, ''), case r.forma
             when 'pix' then 'Pix'
             when 'cartao_credito' then 'Cartão de crédito'
             when 'cartao_debito' then 'Cartão de débito'
             when 'boleto' then 'Boleto'
             when 'dinheiro' then 'Dinheiro'
             when 'transferencia' then 'Transferência'
             when '' then 'Sem forma'
             else r.forma end) as nome,
           count(*)             as quantidade,
           sum(r.amount_cents)  as total_cents
      from recebidas r
      left join public.payment_fee_settings pf
        on pf.organization_id = p_org and pf.forma = r.forma
     group by 1, 2
  ),
  produto_por_moeda as (
    select f.moeda, i.product_name as nome,
           sum(i.quantity)      as quantidade,
           sum(i.amount_cents)  as total_cents
      from public.crm_sale_items i
      join fechadas f on f.id = i.lead_id
     where i.organization_id = p_org
     group by 1, 2
  ),
  cliente_por_moeda as (
    select r.moeda, r.contact_id,
           count(distinct r.lead_id) as vendas,
           sum(r.amount_cents)       as total_cents
      from recebidas r
     where r.contact_id is not null
     group by 1, 2
  ),
  pessoa_por_moeda as (
    select f.moeda, f.owner_user_id,
           count(*)            as vendas,
           sum(f.valor_cents)  as total_cents
      from fechadas f
     group by 1, 2
  ),
  moedas as (
    select moeda from lancamentos
    union select moeda from recebidas
    union select moeda from previstas
    union select moeda from fechadas
    union select moeda from canceladas
  )
  select jsonb_build_object(
    'de', p_de,
    'ate', p_ate,
    'por_moeda', coalesce((
      select jsonb_object_agg(m.moeda, jsonb_build_object(
        'recebido_cents',   coalesce((select sum(r.amount_cents) from recebidas r where r.moeda = m.moeda), 0),
        'entradas_cents',   coalesce((select sum(r.amount_cents) from recebidas r where r.moeda = m.moeda), 0)
                          + coalesce((select sum(l.amount_cents) from lancamentos l where l.moeda = m.moeda and l.direction = 'in'), 0),
        'saidas_cents',     coalesce((select sum(l.amount_cents) from lancamentos l where l.moeda = m.moeda and l.direction = 'out'), 0),
        'saldo_cents',      coalesce((select sum(r.amount_cents) from recebidas r where r.moeda = m.moeda), 0)
                          + coalesce((select sum(case when l.direction = 'in' then l.amount_cents else -l.amount_cents end) from lancamentos l where l.moeda = m.moeda), 0),
        'a_receber_cents',  coalesce((select sum(p.amount_cents) from previstas p where p.moeda = m.moeda), 0),
        'vendas_fechadas',  (select count(*) from fechadas f where f.moeda = m.moeda),
        'vendas_canceladas',(select count(*) from canceladas c where c.moeda = m.moeda),
        'faturado_cents',   coalesce((select sum(f.valor_cents) from fechadas f where f.moeda = m.moeda), 0),
        'ticket_medio_cents', coalesce((select (sum(f.valor_cents) / nullif(count(*), 0))::bigint from fechadas f where f.moeda = m.moeda), 0),
        'por_forma', coalesce((
          select jsonb_agg(jsonb_build_object('nome', x.nome, 'quantidade', x.quantidade, 'total_cents', x.total_cents)
                 order by x.total_cents desc)
            from forma_por_moeda x where x.moeda = m.moeda
        ), '[]'::jsonb),
        'por_produto', coalesce((
          select jsonb_agg(jsonb_build_object('nome', t.nome, 'quantidade', t.quantidade, 'total_cents', t.total_cents)
                 order by t.total_cents desc)
            from (select * from produto_por_moeda x where x.moeda = m.moeda order by x.total_cents desc limit 10) t
        ), '[]'::jsonb),
        'por_cliente', coalesce((
          select jsonb_agg(jsonb_build_object('contact_id', t.contact_id, 'vendas', t.vendas, 'total_cents', t.total_cents)
                 order by t.total_cents desc)
            from (select * from cliente_por_moeda x where x.moeda = m.moeda order by x.total_cents desc limit 10) t
        ), '[]'::jsonb),
        'por_pessoa', coalesce((
          select jsonb_agg(jsonb_build_object('owner_user_id', x.owner_user_id, 'vendas', x.vendas, 'total_cents', x.total_cents)
                 order by x.total_cents desc)
            from pessoa_por_moeda x where x.moeda = m.moeda
        ), '[]'::jsonb)
      ))
        from moedas m
    ), '{}'::jsonb)
  );
$$;

revoke execute on function public.fn_relatorio_financas(uuid, date, date) from public, anon;
grant  execute on function public.fn_relatorio_financas(uuid, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
