-- manifest: **Passo 1 do modelo CRM (Cliente × Oportunidade × Pagamento).** `crm_historico_de_estados` (de→para, quando, quem, motivo) escrito por trigger para a etapa da oportunidade e o status da parcela; `crm_stages.tipo` (aberta | qualificada | comprou | nao_comprou | desqualificado) derivado de is_won/is_lost/qualification e `crm_stages.fixa`; toda etapa Desqualificado fixa criada em cada funil (papel `disqualified`, que já liga o evento DisqualifiedLead da Meta). Só aditivo: nada do que existe muda de comportamento.

-- ── 1. Tipo e fixa da etapa ─────────────────────────────────────────────────
alter table public.crm_stages
  add column if not exists tipo text,
  add column if not exists fixa boolean not null default false;

alter table public.crm_stages drop constraint if exists crm_stages_tipo_check;
alter table public.crm_stages add constraint crm_stages_tipo_check
  check (tipo is null or tipo in ('aberta', 'qualificada', 'comprou', 'nao_comprou', 'desqualificado'));

create or replace function public.fn_crm_stages_tipo()
returns trigger language plpgsql as $f$
begin
  new.tipo := case
    when new.is_won then 'comprou'
    when new.is_lost then 'nao_comprou'
    when new.qualification = 'disqualified' then 'desqualificado'
    when new.qualification = 'mql' then 'qualificada'
    else 'aberta'
  end;
  if new.is_won or new.is_lost or new.qualification = 'disqualified' then
    new.fixa := true;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_crm_stages_tipo on public.crm_stages;
create trigger trg_crm_stages_tipo
  before insert or update of is_won, is_lost, qualification on public.crm_stages
  for each row execute function public.fn_crm_stages_tipo();

update public.crm_stages set is_won = is_won;  -- dispara o trigger nas linhas existentes

comment on column public.crm_stages.tipo is
  'Tipo da etapa, derivado: aberta, qualificada (MQL), comprou, nao_comprou, desqualificado.';
comment on column public.crm_stages.fixa is
  'Etapa fixa do funil (Comprou, Não comprou, Desqualificado): não se exclui nem muda de tipo.';

-- ── 2. A etapa Desqualificado fixa em todo funil que ainda não tem ──────────
insert into public.crm_stages (organization_id, pipeline_id, name, slug, position, color, qualification)
select p.organization_id, p.id, 'Desqualificado', 'desqualificado',
       coalesce((select max(s.position) from public.crm_stages s where s.pipeline_id = p.id), 0) + 1000,
       '#6b7280', 'disqualified'
  from public.crm_pipelines p
 where not p.is_archived
   and not exists (
     select 1 from public.crm_stages s
      where s.pipeline_id = p.id and s.qualification = 'disqualified' and not s.is_archived
   )
   and not exists (
     select 1 from public.crm_stages s where s.pipeline_id = p.id and s.slug = 'desqualificado'
   );

-- ── 3. Histórico de estados ─────────────────────────────────────────────────
create table if not exists public.crm_historico_de_estados (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entidade text not null,
  entidade_id uuid not null,
  contact_id uuid references public.contacts(id) on delete set null,
  de text,
  para text not null,
  motivo text,
  autor uuid references auth.users(id) on delete set null,
  autor_tipo text not null default 'sistema',
  created_at timestamptz not null default now(),
  constraint crm_historico_entidade_check check (entidade in ('pessoa', 'oportunidade', 'pagamento')),
  constraint crm_historico_autor_tipo_check check (autor_tipo in ('usuario', 'ia', 'sistema'))
);

create index if not exists crm_historico_entidade_idx
  on public.crm_historico_de_estados (entidade, entidade_id, created_at desc);
create index if not exists crm_historico_org_idx
  on public.crm_historico_de_estados (organization_id, created_at desc);
create index if not exists crm_historico_contato_idx
  on public.crm_historico_de_estados (contact_id, created_at desc);

alter table public.crm_historico_de_estados enable row level security;

drop policy if exists crm_historico_select on public.crm_historico_de_estados;
create policy crm_historico_select on public.crm_historico_de_estados
  for select using (
    public.fn_is_platform_admin()
    or organization_id in (select public.fn_user_org_ids())
  );

revoke all on public.crm_historico_de_estados from anon;
revoke insert, update, delete on public.crm_historico_de_estados from authenticated;
grant select on public.crm_historico_de_estados to authenticated;

-- ── 4. Triggers que escrevem o histórico ────────────────────────────────────
create or replace function public.fn_historico_etapa_da_oportunidade()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_de text;
  v_para text;
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    select name into v_de from public.crm_stages where id = old.stage_id;
  end if;
  select name into v_para from public.crm_stages where id = new.stage_id;
  insert into public.crm_historico_de_estados
    (organization_id, entidade, entidade_id, contact_id, de, para, motivo, autor, autor_tipo)
  values
    (new.organization_id, 'oportunidade', new.id, new.contact_id, v_de, coalesce(v_para, '—'),
     case when new.status = 'lost' then new.lost_reason when new.status = 'won' then new.won_reason end,
     auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
  return new;
end
$f$;

revoke execute on function public.fn_historico_etapa_da_oportunidade() from public, anon, authenticated;

drop trigger if exists trg_historico_etapa_da_oportunidade on public.crm_leads;
create trigger trg_historico_etapa_da_oportunidade
  after insert or update of stage_id on public.crm_leads
  for each row execute function public.fn_historico_etapa_da_oportunidade();

create or replace function public.fn_historico_status_do_pagamento()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_contact uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  select contact_id into v_contact from public.crm_sales where id = new.sale_id;
  insert into public.crm_historico_de_estados
    (organization_id, entidade, entidade_id, contact_id, de, para, autor, autor_tipo)
  values
    (new.organization_id, 'pagamento', new.id, v_contact,
     case when tg_op = 'UPDATE' then old.status end, new.status,
     auth.uid(), case when auth.uid() is null then 'sistema' else 'usuario' end);
  return new;
end
$f$;

revoke execute on function public.fn_historico_status_do_pagamento() from public, anon, authenticated;

drop trigger if exists trg_historico_status_do_pagamento on public.crm_sale_payments;
create trigger trg_historico_status_do_pagamento
  after insert or update of status on public.crm_sale_payments
  for each row execute function public.fn_historico_status_do_pagamento();

notify pgrst, 'reload schema';
