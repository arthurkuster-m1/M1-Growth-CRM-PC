-- manifest: **Lacunas do modelo CRM.** Parcela recebida emite `lead.payment_received` (uma compra por mensalidade para a plataforma de anúncio). `contacts.ativo_ate` (quando a pessoa deixa de ser cliente ativa se não pagar de novo: a próxima recompra prevista), motivo do ciclo com a data; `crm_leads.proxima_acao` e `proxima_acao_em` (próximo passo da oportunidade, para o alerta "sem próxima ação"); ciclo recalculado para todos.

alter table public.contacts add column if not exists ativo_ate date;
alter table public.crm_leads
  add column if not exists proxima_acao text not null default '',
  add column if not exists proxima_acao_em date;

comment on column public.contacts.ativo_ate is
  'Fim da janela de cliente ativo (último pagamento + janela do produto): a próxima recompra prevista. Nulo em assinatura ativa e em quem não é ativo.';

create or replace function public.fn_contato_recalcula_ciclo(p_org uuid, p_contact uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_padrao integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_abertas integer; v_valor bigint; v_proximo date;
  v_ops integer; v_desq integer;
  v_ja_pagou boolean; v_ativo boolean; v_assinatura boolean;
  v_anterior text; v_novo text; v_motivo text;
  v_ativo_ate date;
begin
  select coalesce(nullif(settings ->> 'janela_ativo_meses', '')::integer, 6)
    into v_padrao from public.organizations where id = p_org;
  v_padrao := least(60, greatest(1, coalesce(v_padrao, 6)));

  select ciclo_de_vida into v_anterior from public.contacts where id = p_contact and organization_id = p_org;

  with ops as (
    select l.id, l.status, l.value_cents, s.tipo,
           exists (
             select 1 from public.crm_sale_payments p
              where p.lead_id = l.id and p.status = 'recebida'
           ) as pago
      from public.crm_leads l
      left join public.crm_stages s on s.id = l.stage_id
     where l.organization_id = p_org and l.contact_id = p_contact
  )
  select
    count(*) filter (where (status = 'open' and coalesce(tipo, 'aberta') <> 'desqualificado')
                        or (status = 'won' and not pago)),
    coalesce(sum(value_cents) filter (where status = 'open' and coalesce(tipo, 'aberta') <> 'desqualificado'), 0),
    count(*),
    count(*) filter (where tipo = 'desqualificado')
    into v_abertas, v_valor, v_ops, v_desq
    from ops;

  select min(p.due_on) into v_proximo
    from public.crm_sale_payments p
    join public.crm_leads l on l.id = p.lead_id
   where l.organization_id = p_org and l.contact_id = p_contact
     and p.status = 'prevista' and l.status <> 'lost';

  with pagos as (
    select l.id as venda, coalesce(p.paid_on, l.paid_on) as quando,
           coalesce(
             (select max(c.janela_ativo_meses)
                from public.crm_sale_items i
                join public.marketing_pages c on c.id = i.product_id
               where i.lead_id = l.id),
             v_padrao) as janela
      from public.crm_leads l
      join public.crm_sale_payments p on p.lead_id = l.id and p.status = 'recebida'
     where l.organization_id = p_org and l.contact_id = p_contact
  )
  select count(*) > 0,
         coalesce(bool_or(quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date), false),
         max((quando + (janela || ' months')::interval)::date)
           filter (where quando is not null and quando >= (v_hoje - (janela || ' months')::interval)::date)
    into v_ja_pagou, v_ativo, v_ativo_ate
    from pagos;

  select exists (
    select 1 from public.crm_leads l
     where l.organization_id = p_org and l.contact_id = p_contact
       and l.is_recurring and l.recurrence_active and l.status <> 'lost'
       and exists (select 1 from public.crm_sale_payments p where p.lead_id = l.id and p.status = 'recebida')
  ) into v_assinatura;

  if v_ativo or v_assinatura then
    v_novo := 'ativo';
    v_motivo := case
      when v_assinatura then 'Assinatura ativa'
      else 'Pagou dentro da janela de cliente ativo, até ' || to_char(v_ativo_ate, 'DD/MM/YYYY')
    end;
  elsif v_ja_pagou then
    if v_abertas > 0 then
      v_novo := 'em_reativacao';
      v_motivo := 'Ex-cliente com nova oportunidade aberta';
    else
      v_novo := 'ex_cliente';
      v_motivo := 'Já pagou, mas está fora da janela de cliente ativo';
    end if;
  elsif v_abertas > 0 then
    v_novo := 'em_negociacao';
    v_motivo := 'Tem oportunidade aberta e ainda não pagou';
  elsif v_ops = 0 then
    v_novo := 'novo_lead';
    v_motivo := 'Entrou e ainda não tem oportunidade';
  elsif v_desq = v_ops then
    v_novo := 'desqualificado';
    v_motivo := 'Todas as oportunidades foram desqualificadas';
  else
    v_novo := 'nunca_comprou';
    v_motivo := 'Todas as oportunidades terminaram sem compra';
  end if;

  update public.contacts
     set ciclo_de_vida = v_novo,
         ciclo_motivo = v_motivo,
         oportunidades_abertas = v_abertas,
         valor_em_aberto_cents = v_valor,
         proximo_vencimento = v_proximo,
         ativo_ate = case when v_novo = 'ativo' and not v_assinatura then v_ativo_ate end,
         ciclo_atualizado_em = case when v_anterior is distinct from v_novo then now() else ciclo_atualizado_em end
   where id = p_contact and organization_id = p_org
     and (ciclo_de_vida is distinct from v_novo
          or ciclo_motivo is distinct from v_motivo
          or oportunidades_abertas is distinct from v_abertas
          or valor_em_aberto_cents is distinct from v_valor
          or proximo_vencimento is distinct from v_proximo
          or ativo_ate is distinct from case when v_novo = 'ativo' and not v_assinatura then v_ativo_ate end);

  if v_anterior is distinct from v_novo then
    insert into public.crm_historico_de_estados
      (organization_id, entidade, entidade_id, contact_id, de, para, motivo, autor, autor_tipo)
    values (p_org, 'pessoa', p_contact, p_contact, v_anterior, v_novo, v_motivo,
            auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
    if v_novo = 'ativo' and v_anterior in ('ex_cliente', 'em_reativacao') then
      perform public.fn_contato_soma_tag(p_contact, p_org, 'Reativado');
    end if;
  end if;
end
$$;

revoke all on function public.fn_contato_recalcula_ciclo(uuid, uuid) from public, anon, authenticated;

-- ── Parcela recebida: o evento que leva cada mensalidade à plataforma de anúncio ──
create or replace function public.fn_parcela_recebida_emite_evento()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.status = 'recebida' and new.lead_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'recebida') then
    perform public.fn_log_event(new.organization_id, 'lead.payment_received',
      jsonb_build_object('lead_id', new.lead_id, 'payment_id', new.id,
                         'amount_cents', new.amount_cents, 'paid_on', new.paid_on));
  end if;
  return null;
end
$f$;
revoke execute on function public.fn_parcela_recebida_emite_evento() from public, anon, authenticated;

drop trigger if exists trg_parcela_recebida_emite_evento on public.crm_sale_payments;
create trigger trg_parcela_recebida_emite_evento
  after insert or update of status on public.crm_sale_payments
  for each row execute function public.fn_parcela_recebida_emite_evento();

select public.fn_ciclo_recalcula_todos(null);

notify pgrst, 'reload schema';
