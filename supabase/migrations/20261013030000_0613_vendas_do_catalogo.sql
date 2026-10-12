-- manifest: **Vendas só de produtos cadastrados.** `crm_sale_items.product_id` (obrigatório, FK `restrict` para a página do produto em Produtos e Ofertas): toda venda é de um produto do catálogo, mesmo que o valor mude por desconto; `demand_campaigns.product_id` (o produto que a campanha vende); a venda de interesse automática nasce com o item do produto; `fn_vendas_por_produto` soma vendas e faturamento por produto.

alter table public.crm_sale_items
  add column if not exists product_id uuid references public.marketing_pages(id) on delete restrict;

-- Itens antigos sem produto (só dados de teste) saem; daqui para a frente o produto é obrigatório.
delete from public.crm_sale_items where product_id is null;
alter table public.crm_sale_items alter column product_id set not null;
create index if not exists crm_sale_items_product_idx on public.crm_sale_items (product_id);

alter table public.demand_campaigns
  add column if not exists product_id uuid references public.marketing_pages(id) on delete set null;

-- Lead entra na campanha: venda de INTERESSE com o item do produto e o ticket previsto.
create or replace function public.fn_lead_interest_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_c record;
  v_sale uuid;
  v_nome text;
begin
  if new.demand_campaign_id is null or new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.demand_campaign_id is not distinct from new.demand_campaign_id then
    return new;
  end if;
  select c.id, c.product_id, c.ticket_cents into v_c
    from public.demand_campaigns c
   where c.id = new.demand_campaign_id and c.organization_id = new.organization_id;
  if not found or v_c.product_id is null or coalesce(v_c.ticket_cents, 0) <= 0 then
    return new;
  end if;
  if exists (select 1 from public.crm_sales s where s.lead_id = new.id) then
    return new;
  end if;
  select title into v_nome from public.marketing_pages where id = v_c.product_id;
  insert into public.crm_sales
    (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
     demand_landing_page_id, demand_creative_id, product_name, amount_cents, status)
  values
    (new.organization_id, new.contact_id, new.id, new.pipeline_id, new.demand_campaign_id,
     new.demand_landing_page_id, new.demand_creative_id, coalesce(v_nome, ''), v_c.ticket_cents,
     'interesse')
  returning id into v_sale;
  insert into public.crm_sale_items
    (organization_id, sale_id, product_id, product_name, amount_cents, position)
  values
    (new.organization_id, v_sale, v_c.product_id, coalesce(nullif(v_nome, ''), 'Produto'),
     v_c.ticket_cents, 0);
  return new;
end
$f$;

-- Vendas e faturamento por produto num período. O dinheiro de uma venda com vários produtos é
-- rateado pelo peso de cada item no valor da venda.
create or replace function public.fn_vendas_por_produto(p_org uuid, p_from date, p_to date)
returns table (product_id uuid, nome text, vendas integer, interesse_cents bigint,
               recebido_cents bigint, a_receber_cents bigint)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with itens as (
    select i.product_id, i.product_name, i.amount_cents as item_cents,
           s.id as sale_id, s.status, s.amount_cents as venda_cents,
           coalesce(s.closed_on, s.paid_on) as fechada_em
      from public.crm_sale_items i
      join public.crm_sales s on s.id = i.sale_id
     where i.organization_id = p_org and s.status <> 'cancelada'
  ),
  parcelas as (
    select p.sale_id,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida' and p.paid_on between p_from and p_to), 0) as recebido,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista' and p.due_on between p_from and p_to), 0) as previsto
      from public.crm_sale_payments p
     where p.organization_id = p_org
     group by p.sale_id
  )
  select it.product_id,
         max(it.product_name) as nome,
         count(distinct it.sale_id) filter (
           where it.status in ('comprometida', 'concluida') and it.fechada_em between p_from and p_to
         )::integer as vendas,
         coalesce(sum(it.item_cents) filter (where it.status = 'interesse'), 0)::bigint as interesse_cents,
         coalesce(sum(case when it.venda_cents > 0
                           then pa.recebido * it.item_cents / it.venda_cents else 0 end), 0)::bigint as recebido_cents,
         coalesce(sum(case when it.venda_cents > 0
                           then pa.previsto * it.item_cents / it.venda_cents else 0 end), 0)::bigint as a_receber_cents
    from itens it
    left join parcelas pa on pa.sale_id = it.sale_id
   where it.status in ('interesse', 'comprometida', 'concluida')
   group by it.product_id;
$$;
revoke all on function public.fn_vendas_por_produto(uuid, date, date) from public, anon;
grant execute on function public.fn_vendas_por_produto(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
