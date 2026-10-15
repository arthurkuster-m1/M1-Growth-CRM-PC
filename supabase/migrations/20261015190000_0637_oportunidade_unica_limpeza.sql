-- manifest: **Passo 7, Fase C (limpeza): a tabela de vendas deixa de existir.** `crm_sales` e as funções do espelho card↔venda saem; itens e parcelas ficam só com `lead_id` (obrigatório) e perdem `sale_id`; `crm_leads.venda_adicional` sai (várias oportunidades por pessoa são o normal). A oportunidade (card) é a única fonte de venda.

-- ── 1. Itens e parcelas: só a oportunidade ──────────────────────────────────
delete from public.crm_sale_items where lead_id is null;
delete from public.crm_sale_payments where lead_id is null;

drop trigger if exists trg_crm_sale_items_lead_id on public.crm_sale_items;
drop trigger if exists trg_crm_sale_payments_lead_id on public.crm_sale_payments;
drop function if exists public.fn_item_ou_parcela_lead_id();

alter table public.crm_sale_items drop column if exists sale_id;
alter table public.crm_sale_payments drop column if exists sale_id;
alter table public.crm_sale_items alter column lead_id set not null;
alter table public.crm_sale_payments alter column lead_id set not null;

-- ── 2. A tabela de vendas e o espelho ───────────────────────────────────────
drop table if exists public.crm_sales cascade;

drop function if exists public.fn_card_origem_para_vendas();
drop function if exists public.fn_sync_card_para_venda();
drop function if exists public.fn_sync_venda_para_card();
drop function if exists public.fn_venda_origem_do_card();
drop function if exists public.fn_venda_para_campos_do_card();
drop function if exists public.fn_venda_muda_de_card();
drop function if exists public.fn_lead_venda_minima();
drop function if exists public.fn_lead_won_sale();
drop function if exists public.fn_ciclo_apos_venda();
drop function if exists public.fn_com_pagamento_apos_venda();
drop function if exists public.fn_crm_sales_after_write();
drop function if exists public.fn_crm_sales_before_write();
drop function if exists public.fn_crm_sales_recurrence_default();
drop function if exists public.fn_crm_sales_valor_do_lead();
drop function if exists public.fn_lead_definir_valor(uuid, bigint);
drop function if exists public.fn_venda_principal(uuid);

-- ── 3. O card não precisa mais marcar "venda adicional" ─────────────────────
alter table public.crm_leads drop column if exists venda_adicional;

-- ── 4. A conferência passa a só olhar o essencial ───────────────────────────
create or replace function public.fn_oportunidade_unica_divergencias()
returns table (tipo text, quantidade bigint)
language sql stable security definer set search_path = public as $f$
  select 'comprou_sem_pagamento'::text, count(*) from public.crm_leads l
   join public.crm_stages s on s.id = l.stage_id
   where s.is_won and not exists (
     select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida'
   )
$f$;
revoke execute on function public.fn_oportunidade_unica_divergencias() from public, anon, authenticated;
grant execute on function public.fn_oportunidade_unica_divergencias() to service_role;

notify pgrst, 'reload schema';
