-- manifest: **Primeira compra pela venda paga; vendas contadas só quando algo foi pago; tags automáticas com inicial maiúscula.** A data da primeira compra do contato passa a ser sempre a da primeira PARCELA RECEBIDA (um sinal já conta; venda concluída sem parcelas conta pela data do pagamento) — recalculada a cada mudança, sem valor "grudado". O contador de vendas do contato conta as vendas com ao menos um pagamento recebido. As tags de origem e de funil nascem como `Campanha: Nome`, `Ad: Nome`, `LP: Nome` e `Funil: Nome` (1ª letra do nome maiúscula), e as já existentes são ajustadas sem duplicar.

-- A inicial maiúscula (o resto do nome fica como está).
create or replace function public.fn_inicial_maiuscula(p text)
returns text
language sql
immutable
as $$
  select case when p is null or p = '' then p else upper(left(p, 1)) || substr(p, 2) end
$$;

-- Contato: LTV, previsto, interesse, vendas pagas, primeira e última compra.
create or replace function public.fn_crm_sales_refresh_contact(p_org uuid, p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ltv bigint; v_prev bigint; v_int bigint; v_n integer; v_first date; v_last date;
begin
  with vendas as (
    select s.id, s.status, s.amount_cents, s.paid_on,
           coalesce(sum(p.amount_cents) filter (where p.status = 'recebida'), 0) as pago,
           coalesce(sum(p.amount_cents) filter (where p.status = 'prevista'), 0) as previsto,
           count(p.id) filter (where p.status <> 'cancelada') as parcelas,
           count(p.id) filter (where p.status = 'recebida') as recebidas,
           min(p.paid_on) filter (where p.status = 'recebida') as primeira_paga,
           max(p.paid_on) filter (where p.status = 'recebida') as ultima_paga
      from public.crm_sales s
      left join public.crm_sale_payments p on p.sale_id = s.id
     where s.organization_id = p_org and s.contact_id = p_contact
     group by s.id
  ),
  pagas as (
    -- Venda "paga": ao menos uma parcela recebida, ou concluída sem parcelas (pela data do pagamento).
    select v.*,
           case when parcelas = 0 and status = 'concluida' then amount_cents else pago end as valor_pago,
           case when parcelas = 0 and status = 'concluida' then paid_on else primeira_paga end as data_primeira,
           case when parcelas = 0 and status = 'concluida' then paid_on else ultima_paga end as data_ultima,
           (recebidas > 0 or (parcelas = 0 and status = 'concluida')) as foi_paga
      from vendas v
  )
  select
    coalesce(sum(valor_pago) filter (where status in ('comprometida', 'concluida')), 0),
    coalesce(sum(case when parcelas = 0 and status = 'comprometida' then amount_cents else previsto end)
             filter (where status in ('comprometida', 'concluida')), 0),
    coalesce(sum(amount_cents) filter (where status = 'interesse'), 0),
    count(*) filter (where foi_paga and status in ('comprometida', 'concluida'))::integer,
    min(data_primeira) filter (where foi_paga and status in ('comprometida', 'concluida')),
    max(data_ultima) filter (where foi_paga and status in ('comprometida', 'concluida'))
    into v_ltv, v_prev, v_int, v_n, v_first, v_last
    from pagas;

  update public.contacts
     set ltv_cents = v_ltv,
         ltv_forecast_cents = v_ltv + v_prev,
         interest_cents = v_int,
         sales_count = v_n,
         last_purchase_on = v_last,
         first_purchase_on = v_first
   where id = p_contact and organization_id = p_org;
end
$$;

-- Tags automáticas: 1ª letra do nome em maiúscula.
create or replace function public.fn_lead_tag_do_funil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if new.contact_id is null then return new; end if;
  select name into v_nome from public.crm_pipelines where id = new.pipeline_id;
  if v_nome is null then return new; end if;
  perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                     'Funil: ' || public.fn_inicial_maiuscula(v_nome));
  return new;
end
$$;

create or replace function public.fn_lead_tags_de_origem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if new.contact_id is null then return new; end if;

  if new.demand_campaign_id is not null
     and (tg_op = 'INSERT' or new.demand_campaign_id is distinct from old.demand_campaign_id) then
    select name into v_nome from public.demand_campaigns
     where id = new.demand_campaign_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                         'Campanha: ' || public.fn_inicial_maiuscula(v_nome));
    end if;
  end if;

  if new.demand_creative_id is not null
     and (tg_op = 'INSERT' or new.demand_creative_id is distinct from old.demand_creative_id) then
    select name into v_nome from public.demand_campaign_creatives
     where id = new.demand_creative_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                         'Ad: ' || public.fn_inicial_maiuscula(v_nome));
    end if;
  end if;

  if new.demand_landing_page_id is not null
     and (tg_op = 'INSERT' or new.demand_landing_page_id is distinct from old.demand_landing_page_id) then
    select name into v_nome from public.demand_campaign_landing_pages
     where id = new.demand_landing_page_id and organization_id = new.organization_id;
    if v_nome is not null then
      perform public.fn_contato_soma_tag(new.contact_id, new.organization_id,
                                         'LP: ' || public.fn_inicial_maiuscula(v_nome));
    end if;
  end if;

  return new;
end
$$;

-- A forma canônica de uma tag automática (qualquer caixa → "Prefixo: Nome").
create or replace function public.fn_tag_canonica(p text)
returns text
language plpgsql
immutable
as $$
declare
  m text[];
begin
  if p is null then return p; end if;
  if lower(btrim(p)) = 'mql' then return 'MQL'; end if;
  m := regexp_match(p, '^\s*(campanha|ad|lp|funil)\s*:\s*(.+?)\s*$', 'i');
  if m is null then return p; end if;
  return case lower(m[1])
           when 'campanha' then 'Campanha'
           when 'ad' then 'Ad'
           when 'lp' then 'LP'
           else 'Funil'
         end || ': ' || public.fn_inicial_maiuscula(m[2]);
end
$$;

-- O que já existe: ajusta as tags automáticas e tira a repetição que a troca de caixa deixaria.
update public.contacts c
   set tags = (
     select coalesce(array_agg(t order by ord), '{}'::text[])
       from (
         select distinct on (lower(public.fn_tag_canonica(x))) public.fn_tag_canonica(x) as t, ord
           from unnest(c.tags) with ordinality as u(x, ord)
          order by lower(public.fn_tag_canonica(x)), ord
       ) s
   )
 where not is_anonymized
   and exists (
     select 1 from unnest(c.tags) x where public.fn_tag_canonica(x) is distinct from x
   );

-- Devolve a caixa real do nome (a tela chegou a gravar tudo em minúsculas): procura o funil, a
-- campanha, o criativo ou a página de mesmo nome na organização.
create or replace function public.fn_tag_com_nome_real(p_org uuid, p text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  m text[];
  v_nome text;
begin
  m := regexp_match(coalesce(p, ''), '^(Campanha|Ad|LP|Funil): (.+)$');
  if m is null then return p; end if;
  if m[1] = 'Funil' then
    select name into v_nome from public.crm_pipelines
     where organization_id = p_org and lower(public.fn_inicial_maiuscula(name)) = lower(m[2]) limit 1;
  elsif m[1] = 'Campanha' then
    select name into v_nome from public.demand_campaigns
     where organization_id = p_org and lower(public.fn_inicial_maiuscula(name)) = lower(m[2]) limit 1;
  elsif m[1] = 'Ad' then
    select name into v_nome from public.demand_campaign_creatives
     where organization_id = p_org and lower(public.fn_inicial_maiuscula(name)) = lower(m[2]) limit 1;
  else
    select name into v_nome from public.demand_campaign_landing_pages
     where organization_id = p_org and lower(public.fn_inicial_maiuscula(name)) = lower(m[2]) limit 1;
  end if;
  if v_nome is null then return p; end if;
  return m[1] || ': ' || public.fn_inicial_maiuscula(v_nome);
end
$$;

update public.contacts c
   set tags = (
     select array_agg(public.fn_tag_com_nome_real(c.organization_id, x) order by ord)
       from unnest(c.tags) with ordinality as u(x, ord)
   )
 where not is_anonymized
   and exists (select 1 from unnest(c.tags) x where x ~ '^(Campanha|Ad|LP|Funil): ');

-- Recalcula o resumo de compras de todos os contatos que têm venda ou data de primeira compra.
do $$
declare
  r record;
begin
  for r in
    select distinct c.organization_id, c.id
      from public.contacts c
     where c.first_purchase_on is not null
        or exists (select 1 from public.crm_sales s where s.contact_id = c.id)
  loop
    perform public.fn_crm_sales_refresh_contact(r.organization_id, r.id);
  end loop;
end
$$;

notify pgrst, 'reload schema';
