-- manifest: **Campanha com vários produtos.** `demand_campaigns.product_ids` (uuid[]) guarda todos os produtos cadastrados que a campanha vende (o primeiro continua em `product_id`); a venda de INTERESSE automática nasce com um item por produto e o ticket médio esperado (`ticket_cents`, editável) dividido entre eles.

alter table public.demand_campaigns
  add column if not exists product_ids uuid[] not null default '{}';

update public.demand_campaigns
   set product_ids = array[product_id]
 where product_id is not null and cardinality(product_ids) = 0;

create or replace function public.fn_lead_interest_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_c record;
  v_sale uuid;
  v_ids uuid[];
  v_n integer;
  v_parte bigint;
  v_resto bigint;
  v_i integer := 0;
  v_pid uuid;
  v_nome text;
  v_nomes text;
begin
  if new.demand_campaign_id is null or new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.demand_campaign_id is not distinct from new.demand_campaign_id then
    return new;
  end if;
  select c.id, c.product_id, c.product_ids, c.ticket_cents into v_c
    from public.demand_campaigns c
   where c.id = new.demand_campaign_id and c.organization_id = new.organization_id;
  if not found or coalesce(v_c.ticket_cents, 0) <= 0 then
    return new;
  end if;
  v_ids := case
    when cardinality(v_c.product_ids) > 0 then v_c.product_ids
    when v_c.product_id is not null then array[v_c.product_id]
    else '{}'::uuid[]
  end;
  v_n := cardinality(v_ids);
  if v_n = 0 then
    return new;
  end if;
  if exists (select 1 from public.crm_sales s where s.lead_id = new.id) then
    return new;
  end if;

  select string_agg(coalesce(nullif(p.title, ''), 'Produto'), ' + ' order by array_position(v_ids, p.id))
    into v_nomes
    from public.marketing_pages p where p.id = any (v_ids);

  insert into public.crm_sales
    (organization_id, contact_id, lead_id, pipeline_id, demand_campaign_id,
     demand_landing_page_id, demand_creative_id, product_name, amount_cents, status)
  values
    (new.organization_id, new.contact_id, new.id, new.pipeline_id, new.demand_campaign_id,
     new.demand_landing_page_id, new.demand_creative_id, left(coalesce(v_nomes, ''), 200),
     v_c.ticket_cents, 'interesse')
  returning id into v_sale;

  v_parte := v_c.ticket_cents / v_n;
  v_resto := v_c.ticket_cents - v_parte * v_n;
  foreach v_pid in array v_ids loop
    select coalesce(nullif(p.title, ''), 'Produto') into v_nome
      from public.marketing_pages p where p.id = v_pid;
    insert into public.crm_sale_items
      (organization_id, sale_id, product_id, product_name, amount_cents, position)
    values
      (new.organization_id, v_sale, v_pid, coalesce(v_nome, 'Produto'),
       v_parte + case when v_i = 0 then v_resto else 0 end, v_i);
    v_i := v_i + 1;
  end loop;
  return new;
end
$f$;

notify pgrst, 'reload schema';
