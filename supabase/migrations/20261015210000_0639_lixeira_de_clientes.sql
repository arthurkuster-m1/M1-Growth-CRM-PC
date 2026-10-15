-- manifest: **Lixeira de clientes (7 dias).** Excluir um cliente leva junto tudo que depende dele (oportunidades, vendas, parcelas, tarefas, notas, atividades, conversas, mensagens e compromissos), mesmo com venda paga; antes de apagar, `fn_excluir_cliente_para_lixeira` guarda uma cópia em `crm_lixeira` (7 dias, `expira_em`), e `fn_restaurar_cliente_da_lixeira` devolve tudo (com `m1.restaurando` ligado, que silencia os gatilhos de evento); `fn_lixeira_esvaziar` apaga de vez o que venceu.

-- ── 1. A lixeira ────────────────────────────────────────────────────────────
create table if not exists public.crm_lixeira (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null default 'cliente',
  contact_id uuid not null,
  nome text not null default '',
  telefone text,
  email text,
  resumo jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  excluido_por uuid references auth.users(id) on delete set null,
  excluido_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '7 days'),
  constraint crm_lixeira_tipo_check check (tipo in ('cliente'))
);

create index if not exists crm_lixeira_org_idx on public.crm_lixeira (organization_id, excluido_em desc);
create index if not exists crm_lixeira_expira_idx on public.crm_lixeira (expira_em);

alter table public.crm_lixeira enable row level security;

drop policy if exists crm_lixeira_select on public.crm_lixeira;
create policy crm_lixeira_select on public.crm_lixeira
  for select using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'agent'))
  );

drop policy if exists crm_lixeira_insert on public.crm_lixeira;
create policy crm_lixeira_insert on public.crm_lixeira
  for insert with check (
    (organization_id in (select public.fn_user_org_ids()))
    and public.fn_role_at_least(organization_id, 'agent')
  );

drop policy if exists crm_lixeira_delete on public.crm_lixeira;
create policy crm_lixeira_delete on public.crm_lixeira
  for delete using (
    (organization_id in (select public.fn_user_org_ids()))
    and public.fn_role_at_least(organization_id, 'agent')
  );

revoke all on public.crm_lixeira from anon;
grant select, insert, delete on public.crm_lixeira to authenticated;

-- ── 2. Inserir uma linha guardada (sem as colunas geradas) ─────────────────
create or replace function public.fn_inserir_da_lixeira(p_tabela regclass, p_linha jsonb)
returns void language plpgsql set search_path = public as $f$
declare
  v_cols text;
  v_linha jsonb := p_linha;
  r record;
  v_existe boolean;
begin
  -- Referência opcional a algo que já não existe (ex.: a demanda da conversa, que saiu junto com o
  -- cliente) volta vazia, em vez de impedir a restauração.
  for r in
    select att.attname as coluna,
           ref.oid::regclass as tabela_ref,
           (select a2.attname from pg_attribute a2
             where a2.attrelid = c.confrelid and a2.attnum = c.confkey[1]) as coluna_ref,
           not att.attnotnull as opcional
      from pg_constraint c
      join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
      join pg_class ref on ref.oid = c.confrelid
     where c.conrelid = p_tabela and c.contype = 'f' and array_length(c.conkey, 1) = 1
  loop
    continue when not r.opcional;
    continue when (v_linha ->> r.coluna) is null;
    execute format('select exists (select 1 from %s where %I = ($1 ->> %L)::%s)',
                   r.tabela_ref, r.coluna_ref, r.coluna,
                   (select format_type(a3.atttypid, a3.atttypmod) from pg_attribute a3
                     where a3.attrelid = p_tabela and a3.attname = r.coluna))
      into v_existe using v_linha;
    if not v_existe then
      v_linha := jsonb_set(v_linha, array[r.coluna], 'null'::jsonb);
    end if;
  end loop;

  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_cols
    from pg_attribute a
   where a.attrelid = p_tabela and a.attnum > 0 and not a.attisdropped
     and a.attgenerated = '' and a.attidentity = ''
     and v_linha ? a.attname;
  if v_cols is null then return; end if;
  execute format(
    'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1)',
    p_tabela, v_cols, v_cols, p_tabela
  ) using v_linha;
end
$f$;

-- ── 3. Excluir o cliente (e tudo que depende dele) para a lixeira ──────────
create or replace function public.fn_excluir_cliente_para_lixeira(
  p_contact_id uuid, p_organization_id uuid
) returns boolean language plpgsql set search_path = public, pg_temp as $f$
declare
  v_contato jsonb;
  v_leads uuid[];
  v_snap jsonb;
  v_nome text;
  v_ltv bigint;
begin
  select to_jsonb(c), coalesce(nullif(btrim(c.display_name), ''), nullif(btrim(c.name), ''), c.phone_number, '—'),
         coalesce(c.ltv_cents, 0)
    into v_contato, v_nome, v_ltv
    from public.contacts c
   where c.id = p_contact_id and c.organization_id = p_organization_id;
  if v_contato is null then
    return false;
  end if;

  select coalesce(array_agg(id), '{}') into v_leads
    from public.crm_leads where contact_id = p_contact_id and organization_id = p_organization_id;

  v_snap := jsonb_build_object(
    'contato', v_contato,
    'oportunidades', coalesce((select jsonb_agg(to_jsonb(l)) from public.crm_leads l where l.id = any (v_leads)), '[]'),
    'itens', coalesce((select jsonb_agg(to_jsonb(i)) from public.crm_sale_items i where i.lead_id = any (v_leads)), '[]'),
    'parcelas', coalesce((select jsonb_agg(to_jsonb(p)) from public.crm_sale_payments p where p.lead_id = any (v_leads)), '[]'),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_tasks t
                          where t.organization_id = p_organization_id
                            and (t.contact_id = p_contact_id or t.lead_id = any (v_leads))), '[]'),
    'notas', coalesce((select jsonb_agg(to_jsonb(n)) from public.lead_notes n where n.contact_id = p_contact_id), '[]'),
    'atividades', coalesce((select jsonb_agg(to_jsonb(a)) from public.crm_lead_activities a
                              where a.organization_id = p_organization_id
                                and (a.contact_id = p_contact_id or a.lead_id = any (v_leads))), '[]'),
    'conversas', coalesce((select jsonb_agg(to_jsonb(cv)) from public.conversations cv
                             where cv.contact_id = p_contact_id and cv.organization_id = p_organization_id), '[]'),
    'mensagens', coalesce((select jsonb_agg(to_jsonb(m)) from public.messages m
                             where m.contact_id = p_contact_id and m.organization_id = p_organization_id), '[]'),
    'compromissos', coalesce((select jsonb_agg(to_jsonb(ap)) from public.calendar_appointments ap
                                where ap.contact_id = p_contact_id and ap.organization_id = p_organization_id), '[]'),
    'historico', coalesce((select jsonb_agg(to_jsonb(h)) from public.crm_historico_de_estados h
                             where h.contact_id = p_contact_id and h.organization_id = p_organization_id), '[]')
  );

  insert into public.crm_lixeira
    (organization_id, contact_id, nome, telefone, email, resumo, snapshot, excluido_por)
  values (
    p_organization_id, p_contact_id, v_nome,
    v_contato ->> 'phone_number', v_contato ->> 'email',
    jsonb_build_object(
      'oportunidades', coalesce(array_length(v_leads, 1), 0),
      'parcelas', jsonb_array_length(v_snap -> 'parcelas'),
      'pago_cents', v_ltv,
      'mensagens', jsonb_array_length(v_snap -> 'mensagens')
    ),
    v_snap, auth.uid()
  );

  -- Tudo que depende do cliente sai junto (mesmo com venda paga).
  delete from public.messages where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.conversations where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.calendar_appointments where contact_id = p_contact_id and organization_id = p_organization_id;
  delete from public.crm_tasks
   where organization_id = p_organization_id
     and (contact_id = p_contact_id or lead_id = any (v_leads));
  delete from public.crm_lead_activities
   where organization_id = p_organization_id
     and (contact_id = p_contact_id or lead_id = any (v_leads));
  delete from public.crm_historico_de_estados
   where organization_id = p_organization_id and contact_id = p_contact_id;
  delete from public.crm_leads
   where organization_id = p_organization_id and contact_id = p_contact_id;
  delete from public.contacts
   where id = p_contact_id and organization_id = p_organization_id;
  return found;
end
$f$;

-- ── 4. Restaurar da lixeira ─────────────────────────────────────────────────
create or replace function public.fn_restaurar_cliente_da_lixeira(
  p_item uuid, p_organization_id uuid
) returns uuid language plpgsql set search_path = public, pg_temp as $f$
declare
  v_item public.crm_lixeira%rowtype;
  v_snap jsonb;
  v_linha jsonb;
  v_contact uuid;
begin
  select * into v_item from public.crm_lixeira
   where id = p_item and organization_id = p_organization_id;
  if not found then
    return null;
  end if;
  v_snap := v_item.snapshot;
  v_contact := v_item.contact_id;

  -- Restaurar não dispara evento nem rotina: o que volta é o que existia.
  perform set_config('m1.restaurando', 'on', true);
  perform set_config('m1.valor_sync', 'on', true);

  perform public.fn_inserir_da_lixeira('public.contacts', v_snap -> 'contato');
  for v_linha in select * from jsonb_array_elements(v_snap -> 'conversas') loop
    perform public.fn_inserir_da_lixeira('public.conversations', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'oportunidades') loop
    perform public.fn_inserir_da_lixeira('public.crm_leads', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'itens') loop
    perform public.fn_inserir_da_lixeira('public.crm_sale_items', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'parcelas') loop
    perform public.fn_inserir_da_lixeira('public.crm_sale_payments', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'mensagens') loop
    perform public.fn_inserir_da_lixeira('public.messages', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'compromissos') loop
    perform public.fn_inserir_da_lixeira('public.calendar_appointments', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'tarefas') loop
    perform public.fn_inserir_da_lixeira('public.crm_tasks', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'notas') loop
    perform public.fn_inserir_da_lixeira('public.lead_notes', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'atividades') loop
    perform public.fn_inserir_da_lixeira('public.crm_lead_activities', v_linha);
  end loop;
  for v_linha in select * from jsonb_array_elements(v_snap -> 'historico') loop
    perform public.fn_inserir_da_lixeira('public.crm_historico_de_estados', v_linha);
  end loop;

  perform set_config('m1.valor_sync', 'off', true);
  perform set_config('m1.restaurando', 'off', true);

  -- O resumo e o ciclo de vida voltam calculados do que acabou de voltar.
  perform public.fn_crm_sales_refresh_contact(p_organization_id, v_contact);
  perform public.fn_contato_recalcula_ciclo(p_organization_id, v_contact);

  delete from public.crm_lixeira where id = p_item;
  return v_contact;
end
$f$;

-- ── 5. Esvaziar o que venceu (a rotina diária chama) ────────────────────────
create or replace function public.fn_lixeira_esvaziar()
returns integer language plpgsql security definer set search_path = public as $f$
declare
  n integer;
begin
  delete from public.crm_lixeira where expira_em < now();
  get diagnostics n = row_count;
  return n;
end
$f$;
revoke execute on function public.fn_lixeira_esvaziar() from public, anon, authenticated;
grant execute on function public.fn_lixeira_esvaziar() to service_role;

-- ── 6. Comprou-sem-pagamento e venda de interesse não valem na restauração ─

create or replace function public.fn_crm_lead_close_on_stage() returns trigger
    language plpgsql
    set search_path to 'public', 'pg_temp'
    as $$
declare
  v_is_won  boolean;
  v_is_lost boolean;
  v_qual    text;
begin
  -- Restauração da lixeira: a linha volta como estava.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.stage_id is not distinct from old.stage_id
     and new.status   is not distinct from old.status then
    return new;
  end if;

  select is_won, is_lost, qualification into v_is_won, v_is_lost, v_qual
    from public.crm_stages where id = new.stage_id;

  if v_is_won then
    if (tg_op = 'INSERT' or old.status is distinct from 'won')
       and not exists (
         select 1 from public.crm_sale_payments p where p.lead_id = new.id and p.status = 'recebida'
       ) then
      raise exception 'comprou_exige_pagamento' using errcode = '22023',
        hint = 'Registre ao menos um pagamento recebido (mesmo só o sinal) antes de mover para Comprou.';
    end if;
    new.status := 'won';
    new.closed_at := coalesce(new.closed_at, now());
  elsif v_is_lost or v_qual = 'disqualified' then
    new.status := 'lost';
    new.closed_at := coalesce(new.closed_at, now());
    if tg_op = 'UPDATE' and old.status is distinct from 'lost' then
      new.lost_from_stage_id := coalesce(new.lost_from_stage_id, old.stage_id);
    end if;
  else
    if tg_op = 'UPDATE' and old.status in ('won','lost') then
      new.status := 'open';
      new.closed_at := null;
      new.lost_from_stage_id := null;
    end if;
  end if;
  return new;
end$$;

create or replace function public.fn_lead_interest_sale()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_c record; v_ids uuid[]; v_n integer; v_parte bigint; v_resto bigint; v_i integer := 0;
  v_pid uuid; v_nome text;
begin
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return new;
  end if;
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
  if v_n = 0 then return new; end if;
  if exists (select 1 from public.crm_sale_items i where i.lead_id = new.id) then
    return new;
  end if;
  perform set_config('m1.valor_sync', 'on', true);
  v_parte := v_c.ticket_cents / v_n;
  v_resto := v_c.ticket_cents - v_parte * v_n;
  foreach v_pid in array v_ids loop
    select coalesce(nullif(p.title, ''), 'Produto') into v_nome
      from public.marketing_pages p where p.id = v_pid;
    insert into public.crm_sale_items
      (organization_id, lead_id, product_id, product_name, amount_cents, position)
    values
      (new.organization_id, new.id, v_pid, coalesce(v_nome, 'Produto'),
       v_parte + case when v_i = 0 then v_resto else 0 end, v_i);
    v_i := v_i + 1;
  end loop;
  update public.crm_leads set value_cents = v_c.ticket_cents where id = new.id;
  perform set_config('m1.valor_sync', 'off', true);
  return new;
end
$f$;

-- ── 7. Gatilhos de evento e rotina: silenciosos na restauração ──────────────
CREATE OR REPLACE FUNCTION public.fn_emit_message_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event text;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if new.direction = 'inbound' then
    if exists (select 1 from public.conversations c
               where c.id = new.conversation_id and c.organization_id = new.organization_id and c.is_group) then
      v_event := 'message.group_received';
    else
      v_event := 'message.received';
    end if;
  else
    v_event := case new.status
                 when 'sending' then 'message.sending'
                 when 'sent' then 'message.sent'
                 when 'failed' then 'message.failed'
                 else 'message.outbound'
               end;
  end if;

  perform public.fn_log_event(
    new.organization_id, v_event,
    jsonb_build_object(
      'message_id', new.id, 'conversation_id', new.conversation_id,
      'contact_id', new.contact_id, 'direction', new.direction,
      'type', new.type, 'status', new.status, 'external_id', new.external_id,
      'channel_session_id', new.channel_session_id,
      'body_preview', "left"(new.body, 280)
    )
  );
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.fn_demanda_abre_no_inbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;
 perform public.fn_service_inbound(new.id); return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.fn_message_service_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if new.direction='inbound' and new.contact_id is not null then perform public.fn_service_lock(new.organization_id,new.contact_id); end if;
 return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.fn_reply_inbound_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if new.direction='inbound' then
  update public.conversations set reply_context_revision=reply_context_revision+1 where organization_id=new.organization_id and id=new.conversation_id and contact_id=new.contact_id;
 end if;
 return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_appointment_inbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a record;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if auth.uid() is null and old.service_revision is null and new.service_revision is not null and new.direction='inbound' then
  perform public.fn_service_lock(new.organization_id,new.contact_id);
  for a in select * from public.calendar_appointments where organization_id=new.organization_id and contact_id=new.contact_id
   and status='no_show' and outcome_recorded_at is not null and new.sent_at>=date_trunc('second',outcome_recorded_at) for update
  loop
   insert into public.appointment_recovery_receipts(organization_id,appointment_id,appointment_revision,result,invalidated_at)
    values(a.organization_id,a.id,a.revision,'stale',clock_timestamp())
    on conflict(organization_id,appointment_id,appointment_revision) do update set invalidated_at=excluded.invalidated_at;
   update public.followup_enrollments set status='cancelled',cancel_reason='O cliente respondeu. Revise o próximo passo.',completed_at=now(),next_eval_at=null,claimed_until=null
    where organization_id=new.organization_id and contact_id=new.contact_id and appointment_id=a.id and appointment_revision=a.revision
     and status in ('active','waiting_reply','paused_handoff','paused_manual');
  end loop;
 end if;
 return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.fn_emit_conversation_routing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 perform public.fn_request_channel_routing(new.organization_id,new.id);
 return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_meet_minimize_runtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 new:=jsonb_populate_record(new,regexp_replace(to_jsonb(new)::text,'https://meet[.]google[.]com/[a-zA-Z0-9-]+',case when tg_table_name='outbound_copies' then '[meet-link]' else '[link da reunião disponível na Agenda]' end,'g')::jsonb);
 return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_service_stamp_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if old.status is distinct from new.status and
   (new.status in ('closed','resolved','archived') or old.status in ('closed','resolved','archived')) then
   new.service_revision:=old.service_revision+1;
   if new.status in ('closed','resolved','archived') then
     new.service_closed_at:=clock_timestamp();
     if old.last_handoff_at is null then new.bot_silenced_until:=null; end if;
   else
     if new.service_started_at is not distinct from old.service_started_at then new.service_started_at:=clock_timestamp(); end if;
     if new.current_demanda_id is not distinct from old.current_demanda_id then new.current_demanda_id:=null; end if;
     if new.status<>'claimed' then
       new.assigned_to_user_id:=null; new.assigned_to_user_name:=null; new.assigned_at:=null;
       new.assignee_kind:=null; new.active_ai_agent_id:=null;
     end if;
   end if;
 end if;
 return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.fn_marcar_contato_como_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_org uuid;
  v_ligado boolean;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_org := old.organization_id;
  else
    v_org := new.organization_id;
  end if;

  -- Espera a ligação em voo commitar. O SELECT abaixo é outro comando, então
  -- em READ COMMITTED tira snapshot novo e enxerga a chave já gravada.
  perform pg_advisory_xact_lock_shared(hashtextextended(v_org::text, 262));

  -- Comparar com 'true'::jsonb nunca lança erro. Um `::boolean` abortaria a
  -- marcação do horário se alguém gravasse lixo na chave.
  select (o.settings -> 'crm' -> 'cliente_pela_agenda') = 'true'::jsonb
    into v_ligado
    from public.organizations o
   where o.id = v_org;

  if v_ligado is not true then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform public.fn_recalcular_cliente_do_contato(v_org, new.contact_id, true);
  elsif tg_op = 'UPDATE' then
    if new.contact_id is not null then
      -- O CONTATO DO HORÁRIO MUDOU — e a condição `is distinct from` tem DUAS
      -- causas, não uma. A primeira é o repontamento de `fn_mesclar_contatos`
      -- (X → Y): o horário só trocou de cadastro, e a escrita no vencedor não é
      -- a virada que as automações devem ver. A segunda é o PRIMEIRO vínculo de
      -- um horário que nasceu sem contato (null → Y), e esse é reconhecimento
      -- de verdade: é a primeira vez que este contato tem horário, e emite como
      -- um INSERT emitiria. Medido antes desta linha: no caminho null → Y o
      -- contato virava cliente, ganhava a etiqueta, ficava com
      -- `client_recognized_at` carimbado — e NENHUM `contact.tag_added` saía,
      -- nem ali nem nunca mais, porque o carimbo não volta a null.
      perform public.fn_recalcular_cliente_do_contato(
        v_org, new.contact_id,
        old.contact_id is not distinct from new.contact_id or old.contact_id is null);
    end if;
    if old.contact_id is not null and old.contact_id is distinct from new.contact_id then
      perform public.fn_recalcular_cliente_do_contato(v_org, old.contact_id, false);
    end if;
  else
    perform public.fn_recalcular_cliente_do_contato(v_org, old.contact_id, false);
  end if;

  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.fn_appointment_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare changed boolean; actor uuid;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if new.contact_id is not null and not exists(select 1 from public.contacts where id=new.contact_id and organization_id=new.organization_id) then
  raise exception 'appointment_contact_scope' using errcode='23503'; end if;
 if new.conversation_id is not null and not exists(select 1 from public.conversations where id=new.conversation_id and organization_id=new.organization_id and contact_id=new.contact_id and not is_group and (auth.uid() is null or public.fn_can_view_conversation(organization_id,assigned_to_user_id))) then
  raise exception 'appointment_conversation_scope' using errcode='23503'; end if;
 if tg_op='INSERT' then
  new.revision:=1;
  -- Legado importado sem autoria não vira fato certificado.
  new.outcome_source_kind:=null; new.outcome_user_id:=null; new.outcome_message_id:=null;
  new.outcome_recorded_at:=null;
  return new;
 end if;
 changed:=row(new.starts_at,new.ends_at,new.status,new.contact_id,new.conversation_id) is distinct from row(old.starts_at,old.ends_at,old.status,old.contact_id,old.conversation_id);
 new.revision:=old.revision+case when changed then 1 else 0 end;
 new.revision_started_at:=case when changed then clock_timestamp() else old.revision_started_at end;
 if changed then new.confirmation_next_at:=null; end if;
 if new.status is distinct from old.status and new.status in ('completed','no_show') then
  actor:=auth.uid();
  if actor is null or not public.fn_role_at_least(new.organization_id,'agent') or not public.fn_support_write_allowed(new.organization_id) then
   raise exception 'appointment_human_confirmation_required' using errcode='42501'; end if;
  if new.starts_at>now() then raise exception 'appointment_not_started' using errcode='22023'; end if;
  new.outcome_user_id:=actor; new.outcome_recorded_at:=clock_timestamp();
  new.outcome_source_kind:=case when new.outcome_message_id is null then 'user' else 'contact_message' end;
  if new.outcome_message_id is not null and not exists(
   select 1 from public.messages m join public.conversations c on c.id=m.conversation_id and c.organization_id=m.organization_id
   where m.id=new.outcome_message_id and m.organization_id=new.organization_id and m.contact_id=new.contact_id
    and (new.conversation_id is null or m.conversation_id=new.conversation_id)
    and m.direction='inbound' and m.service_revision is not null and m.service_revision=c.service_revision
    and m.demanda_id is not distinct from c.current_demanda_id and m.created_at>=old.revision_started_at
    and not c.is_group and public.fn_can_view_conversation(c.organization_id,c.assigned_to_user_id)
  ) then raise exception 'appointment_message_not_evidence' using errcode='42501'; end if;
 elsif changed then
  new.outcome_source_kind:=null; new.outcome_user_id:=null; new.outcome_message_id:=null;
  new.outcome_recorded_at:=null;
 else
  new.outcome_source_kind:=old.outcome_source_kind;
  -- SET NULL por retenção da FK é erosão de referência, não nova autoria.
  new.outcome_user_id:=case when new.outcome_user_id is null and not exists(select 1 from auth.users where id=old.outcome_user_id) then null else old.outcome_user_id end;
  new.outcome_message_id:=case when new.outcome_message_id is null and not exists(select 1 from public.messages where id=old.outcome_message_id and organization_id=old.organization_id) then null else old.outcome_message_id end;
  new.outcome_recorded_at:=old.outcome_recorded_at;
 end if;
 return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.fn_carimbar_ida_ao_google()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  -- `now()` e não `new.updated_at`: os dois são o instante de início da
  -- transação, então o valor é o mesmo — e usar `now()` remove a dependência de
  -- ORDEM entre este trigger e o de `updated_at`.
  if new.google_synced_at is not null
     and (tg_op = 'INSERT' or new.google_synced_at is distinct from old.google_synced_at) then
    new.google_synced_at := now();
  end if;
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.fn_google_projection_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare changed boolean; inbound boolean; decision boolean; redacted boolean;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 redacted:=new.contact_id is not null and exists(select 1 from public.contacts where organization_id=new.organization_id and id=new.contact_id and is_anonymized);
 if redacted then
  new.google_base_projection:=null;new.google_conflict:=null;new.google_pending_write:=null;new.google_claim_token:=null;new.google_claim_until:=null;new.google_etag:=null;new.guest_email:=null;
  if tg_op='UPDATE' then new.google_claim_epoch:=old.google_claim_epoch+1;new.google_local_revision:=old.google_local_revision;new.google_synced_local_revision:=old.google_local_revision;end if;
  return new;
 end if;
 if tg_op='INSERT' then
  new.google_local_revision:=1;new.google_synced_local_revision:=0;
  if auth.uid() is not null then
   new.google_base_projection:=null;new.google_etag:=null;new.google_pending_write:=null;new.google_conflict:=null;
   new.google_claim_token:=null;new.google_claim_epoch:=0;new.google_claim_until:=null;
   new.google_connection_id:=null;new.google_calendar_id:=null;new.google_event_id:=null;
  end if;
  return new;
 end if;
 decision:=auth.uid()=old.owner_user_id and public.fn_role_at_least(new.organization_id,'agent') and public.fn_support_write_allowed(new.organization_id)
  and old.google_conflict is not null and new.google_conflict-'resolution'=old.google_conflict-'resolution'
  and new.google_conflict->'resolution'->>'actor_id'=auth.uid()::text
  and new.google_conflict->'resolution'->>'choice' in ('google','local','preserve_remote')
  and old.google_conflict->>'revision'=old.revision::text and old.google_conflict->>'local_revision'=old.google_local_revision::text
  and old.google_conflict->>'etag' is not distinct from old.google_etag;
 if auth.uid() is not null and (row(new.google_synced_at,new.google_sync_error) is distinct from row(old.google_synced_at,old.google_sync_error)
  or (new.google_next_attempt_at is distinct from old.google_next_attempt_at and not coalesce(auth.uid()=old.owner_user_id and public.fn_role_at_least(new.organization_id,'agent') and public.fn_support_write_allowed(new.organization_id)
    and new.google_next_attempt_at<=clock_timestamp() and (old.google_conflict is null or decision),false))) then
  raise exception 'google_metadata_private' using errcode='42501';end if;
 if auth.uid() is not null and ((new.google_conflict is distinct from old.google_conflict and not coalesce(decision,false)) or row(new.google_base_projection,new.google_pending_write,new.google_claim_token,new.google_claim_epoch,new.google_claim_until,new.google_synced_local_revision,new.google_etag,new.google_connection_id,new.google_calendar_id,new.google_event_id)
  is distinct from row(old.google_base_projection,old.google_pending_write,old.google_claim_token,old.google_claim_epoch,old.google_claim_until,old.google_synced_local_revision,old.google_etag,old.google_connection_id,old.google_calendar_id,old.google_event_id)) then
  raise exception 'google_metadata_private' using errcode='42501';
 end if;
 changed:=row(new.starts_at,new.ends_at,new.time_zone,new.status='cancelled',new.title,new.description,new.location_kind,new.location_details,new.guest_email)
  is distinct from row(old.starts_at,old.ends_at,old.time_zone,old.status='cancelled',old.title,old.description,old.location_kind,old.location_details,old.guest_email);
 -- Única entrada que modifica base e domínio juntos é o núcleo service-only.
 -- Não há GUC ou flag no body público que suprima revisão.
 inbound:=row(new.title,new.description,new.location_kind,new.location_details,new.guest_email) is not distinct from row(old.title,old.description,old.location_kind,old.location_details,old.guest_email) and auth.uid() is null and new.google_base_projection is distinct from old.google_base_projection
  and (new.google_base_projection->'shared'->>'starts_at')::timestamptz=new.starts_at
  and (new.google_base_projection->'shared'->>'ends_at')::timestamptz=new.ends_at
  and new.google_base_projection->'shared'->>'time_zone'=new.time_zone
  and (new.google_base_projection->'shared'->>'cancelled')::boolean=(new.status='cancelled');
 new.google_local_revision:=old.google_local_revision+case when changed and not coalesce(inbound,false) then 1 else 0 end;
 if changed then new.google_next_attempt_at:=now(); end if;
 return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_meet_delivery_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare jid uuid; b jsonb;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 -- A MESMA ORDEM DE TRAVA das ~20 irmãs: contato PRIMEIRO, job_queue depois.
 -- Sem esta linha, este gatilho já segurava a linha do compromisso (é BEFORE/
 -- AFTER na própria calendar_appointments) e ia travar job_queue sem o mutex do
 -- contato, enquanto fn_meet_redact_contact (0229) pega o mutex do contato e só
 -- então mexe em job_queue. Duas ordens opostas sobre os mesmos dois recursos =
 -- deadlock (40P01) sob concorrência, e quem paga é o cliente com anonimização
 -- LGPD acontecendo enquanto um link de reunião é entregue.
 perform public.fn_service_lock(new.organization_id,new.contact_id);
 -- ⚠️ `status` ENTRA AQUI, e a falta dele era um buraco REAL que só apareceu
 -- ao abrir a entrega para compromisso sem Meet.
 --
 -- A guarda olhava só `meeting_state='cancelled'` — o estado do LINK, não do
 -- compromisso. Enquanto a entrega exigia link pronto isso bastava por
 -- acidente: cancelar o compromisso cancelava o link junto. Sem Meet não há
 -- link para cancelar, e um compromisso CANCELADO passava a enfileirar
 -- entrega. O porteiro do envio recusaria depois (`a.status<>'cancelled'`),
 -- então o cliente não receberia nada — mas o job nasceria para morrer
 -- bloqueado, e a tela mostraria uma entrega a caminho que nunca sai.
 --
 -- Achado do @paulolimajr77, e foi o teste DELE que o pegou aqui.
 if new.status='cancelled' or new.meeting_state='cancelled' or new.meeting_delivery->>'state' in ('blocked','stale') then
  update public.job_queue set status='failed',locked_at=null,locked_by=null,payload='{}',last_error='meet_delivery_stale'
   where organization_id=new.organization_id and id=new.meeting_delivery_job_id and kind='transactional_delivery' and status in ('pending','running');
  return new;
 end if;
 if new.meeting_state='failed' then perform public.fn_meet_notice(new.organization_id,new.id,'meeting_failed');end if;
 -- ⛔ ESPERAR O LINK VALE SÓ ONDE O LOCAL É O MEET.
 --
 -- Esta é a exigência mais fácil de esquecer e a pior de esquecer: num
 -- compromisso PRESENCIAL o `meeting_state` é `not_requested` para sempre,
 -- então a entrega era autorizada, o gatilho passava por aqui, devolvia sem
 -- enfileirar nada, e a entrega ficava em `waiting_for_link` PARA SEMPRE — em
 -- silêncio, sem job, sem aviso e sem erro. Foi o teste do autor que a achou.
 --
 -- Onde o local É o Meet, nada muda: sem link pronto não sai job, porque
 -- mandar uma reunião sem como entrar nela é pior que não mandar.
 if (new.location_kind='google_meet' and new.meeting_state<>'ready')
  or new.meeting_delivery->>'state'<>'waiting_for_link' then return new;end if;
 b:=new.meeting_delivery->'service_boundary';
 if not public.fn_meet_boundary_current(b) then
  update public.calendar_appointments set meeting_delivery=meeting_delivery||'{"state":"stale","error":"service_boundary_stale"}' where organization_id=new.organization_id and id=new.id;
  perform public.fn_meet_notice(new.organization_id,new.id,'service_boundary_stale');return new;
 end if;
 jid:=gen_random_uuid();
 insert into public.job_queue(id,organization_id,contact_id,kind,payload,run_after)
 values(jid,new.organization_id,new.contact_id,'transactional_delivery',jsonb_build_object('appointment_id',new.id,'meeting_request_id',new.meeting_request_id,
  'delivery_generation',new.meeting_delivery->>'generation','service_boundary',b,
  -- O MOTIVO decide a FRASE que o cliente lê. Ausente = `primeiro_envio`,
  -- que é o comportamento de antes desta migration e o certo para toda
  -- entrega que já estava na fila quando ela foi aplicada.
  'motivo',coalesce(new.meeting_delivery->>'motivo','primeiro_envio')),
  -- ANTIRREPETIÇÃO: a correção ESPERA antes de sair, e uma remarcação nova
  -- dentro da janela substitui esta. Sem a espera, arrastar o compromisso na
  -- grade viraria uma mensagem por arrasto.
  coalesce((new.meeting_delivery->>'nao_antes_de')::timestamptz, now()));
 update public.calendar_appointments set meeting_delivery_job_id=jid,meeting_delivery=meeting_delivery||'{"state":"queued"}'
  where organization_id=new.organization_id and id=new.id;
 return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_meet_stamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare redacted boolean; j public.job_queue; b jsonb;
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

 if current_user in ('authenticated','anon') then
  if tg_op='INSERT' then
   if new.meeting_delivery<>'{"state":"none"}'::jsonb or new.meeting_request_id is not null or new.meeting_url is not null or new.meeting_state<>'not_requested' or new.meeting_requested_at is not null or new.meeting_received_at is not null or new.meeting_ready_at is not null or new.meeting_attempts<>0 or new.meeting_last_error is not null or new.meeting_next_attempt_at is not null or new.meeting_delivery_job_id is not null then raise exception 'meet_metadata_private' using errcode='42501';end if;
  elsif row(new.meeting_state,new.meeting_request_id,new.meeting_requested_at,new.meeting_received_at,new.meeting_ready_at,new.meeting_attempts,new.meeting_last_error,new.meeting_next_attempt_at,new.meeting_delivery,new.meeting_delivery_job_id,new.meeting_url)
   is distinct from row(old.meeting_state,old.meeting_request_id,old.meeting_requested_at,old.meeting_received_at,old.meeting_ready_at,old.meeting_attempts,old.meeting_last_error,old.meeting_next_attempt_at,old.meeting_delivery,old.meeting_delivery_job_id,old.meeting_url) then
   raise exception 'meet_metadata_private' using errcode='42501';
  end if;
 end if;
 select is_anonymized into redacted from public.contacts where id=new.contact_id and organization_id=new.organization_id;
 if (redacted or new.status='cancelled' or new.location_kind<>'google_meet') and (new.location_kind='google_meet' or new.meeting_state<>'not_requested') then
  if new.location_kind='google_meet' or new.meeting_state<>'not_requested' or new.meeting_requested_at is not null or new.meeting_received_at is not null or new.meeting_ready_at is not null or new.meeting_attempts<>0 or new.meeting_last_error is not null or new.meeting_next_attempt_at is not null or new.meeting_delivery_job_id is not null then new.meeting_state:='cancelled';end if;
  new.meeting_request_id:=null;new.meeting_url:=null;new.meeting_last_error:=null;new.meeting_next_attempt_at:=null;
  new.meeting_delivery:=jsonb_build_object('state',case when redacted then 'blocked' else 'stale' end);
 elsif new.location_kind='google_meet' and new.meeting_state='not_requested' then
  new.meeting_state:='pending';new.meeting_request_id:=gen_random_uuid();new.meeting_next_attempt_at:=now();
 end if;
 if tg_op='INSERT' and new.meeting_delivery ? 'booking_claim' then
  perform public.fn_service_lock(new.organization_id,new.contact_id);
  select * into j from public.job_queue where organization_id=new.organization_id and id=(new.meeting_delivery->>'source_operation_id')::uuid for update;
  b:=new.meeting_delivery->'service_boundary';
  if j.contact_id is distinct from new.contact_id or j.status is distinct from 'running' or j.kind not in ('inbound_turn','followup_turn','case_reply_turn','operator_turn')
   or j.locked_by is distinct from new.meeting_delivery->'booking_claim'->>'worker_id' or j.locked_at is distinct from (new.meeting_delivery->'booking_claim'->>'acquired_at')::timestamptz
   or j.payload->'service_boundary' is distinct from b or not public.fn_meet_boundary_current(b) or b->>'conversation_id' is distinct from new.conversation_id::text then
   raise exception 'meet_booking_stale' using errcode='40001';end if;
  if new.meeting_delivery->'authorized_by'->>'kind' is distinct from 'ai_agent' then raise exception 'meet_booking_origin_invalid' using errcode='42501';end if;
  new.meeting_delivery:=new.meeting_delivery-'booking_claim';
 end if;
 if new.meeting_delivery ? 'generation' and (tg_op='INSERT' or new.meeting_delivery->>'generation' is distinct from old.meeting_delivery->>'generation') then
  new.meeting_delivery:=new.meeting_delivery||jsonb_build_object('channel_session_id',(select channel_session_id from public.conversations where organization_id=new.organization_id and contact_id=new.contact_id and id::text=new.meeting_delivery->'service_boundary'->>'conversation_id'));
 end if;
 if new.meeting_state='pending' and new.meeting_next_attempt_at is not null then new.google_next_attempt_at:=least(new.google_next_attempt_at,new.meeting_next_attempt_at);end if;
 return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.fn_contact_first_approach()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if new.direction = 'outbound' then
    update public.contacts
       set first_approached_at = coalesce(new.sent_at, new.created_at, now())
     where id = new.contact_id
       and organization_id = new.organization_id
       and first_approached_at is null;
  end if;
  return new;
end
$function$
;

CREATE OR REPLACE FUNCTION public.fn_update_last_activity_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  -- LISTA POSITIVA: só isto conta como "alguém tocou este negócio". Tipo que
  -- não está aqui NÃO quebra o silêncio — inclusive tipo que ainda não existe.
  -- Ver o cabeçalho da 0079 antes de acrescentar linha nesta lista.
  if new.type not in (
    'ai_turn',              -- a IA falou com o cliente
    'note',                 -- alguém registrou trabalho no negócio
    'lead_edited',          -- humano mexeu nos dados
    'stage_changed',        -- humano moveu o negócio
    'next_action_approved', -- humano decidiu agir
    -- (0235) Uma ligação ATENDIDA é interação, e das mais fortes: alguém falou
    -- com o cliente. Sem esta linha o Radar de Risco seguia marcando como frio
    -- quem tinha acabado de passar vinte minutos ao telefone, e a IA propunha
    -- "retomar contato" com quem nunca ficou sem contato.
    --
    -- `voice_call_missed` NÃO entra, e a ausência é a regra e não esquecimento:
    -- telefone que tocou sem resposta é constatação de silêncio, não quebra
    -- dele. É exatamente a assimetria que a 0079 existe para preservar.
    'voice_call'
  ) then
    return new;
  end if;

  update public.crm_leads
     set last_activity_at = greatest(coalesce(last_activity_at, '-infinity'::timestamptz), new.performed_at)
   where id = new.lead_id;

  if new.contact_id is not null then
    update public.contacts
       set last_activity_at = greatest(coalesce(last_activity_at, '-infinity'::timestamptz), new.performed_at)
     where id = new.contact_id;
  end if;
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION public.fn_crm_tasks_historico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_motivo text := nullif(btrim(coalesce(current_setting('m1.motivo', true), '')), '');
begin
  -- Restauração da lixeira: o histórico volta sem disparar eventos nem rotinas.
  if coalesce(current_setting('m1.restaurando', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.cronograma_lado is not null then
      insert into public.crm_task_historico (organization_id, task_id, tipo, para_prazo, situacao, autor)
      values (new.organization_id, new.id, 'entrou_no_cronograma', new.due_date, new.status, auth.uid());
    end if;
    return new;
  end if;

  if old.cronograma_lado is null and new.cronograma_lado is not null then
    insert into public.crm_task_historico (organization_id, task_id, tipo, para_prazo, situacao, autor)
    values (new.organization_id, new.id, 'entrou_no_cronograma', new.due_date, new.status, auth.uid());
  elsif old.cronograma_lado is not null and new.cronograma_lado is null then
    insert into public.crm_task_historico (organization_id, task_id, tipo, de_prazo, situacao, autor)
    values (new.organization_id, new.id, 'saiu_do_cronograma', old.due_date, new.status, auth.uid());
  end if;

  if new.cronograma_lado is null then return new; end if;

  if old.due_date is distinct from new.due_date then
    insert into public.crm_task_historico
      (organization_id, task_id, tipo, de_prazo, para_prazo, situacao, motivo, autor)
    values (new.organization_id, new.id, 'prazo_alterado', old.due_date, new.due_date,
            new.status, v_motivo, auth.uid());
  end if;

  if old.status is distinct from new.status then
    if new.status = 'done' then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'concluida', new.due_date, new.status, v_motivo, auth.uid());
    elsif new.status = 'cancelled' then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'cancelada', new.due_date, new.status, v_motivo, auth.uid());
    elsif old.status in ('done', 'cancelled') then
      insert into public.crm_task_historico
        (organization_id, task_id, tipo, de_prazo, situacao, motivo, autor)
      values (new.organization_id, new.id, 'reaberta', new.due_date, new.status, v_motivo, auth.uid());
    end if;
  end if;
  return new;
end
$function$
;


notify pgrst, 'reload schema';
