-- manifest: **Papéis de qualificação nas etapas, modelos de funil e páginas opcionais da campanha.** `crm_stages.qualification` ('mql' | 'disqualified'): entrar na etapa liga a regra da Meta (QualifiedLead / DisqualifiedLead) e, no MQL, marca o contato como MQL; `meta_ads_conversion_rules` aceita `DisqualifiedLead`; `demand_funnel_templates` (modelos de funil reutilizáveis entre campanhas); `demand_campaigns.optional_tabs` (quais páginas opcionais — landing, criativos, abordagem — a campanha mostra; nulo = padrão do tipo).

-- ============================================================================
-- 0605
-- ============================================================================

-- ── 1. O papel de qualificação da etapa ─────────────────────────────────────
alter table public.crm_stages
  add column if not exists qualification text;

alter table public.crm_stages drop constraint if exists crm_stages_qualification_check;
alter table public.crm_stages add constraint crm_stages_qualification_check
  check (qualification is null or qualification in ('mql', 'disqualified'));

-- Uma etapa de qualificação não é de ganho nem de perda (a escolha é uma só).
alter table public.crm_stages drop constraint if exists crm_stages_qualification_exclusive;
alter table public.crm_stages add constraint crm_stages_qualification_exclusive
  check (qualification is null or (not is_won and not is_lost));

comment on column public.crm_stages.qualification is
  'Papel de qualificação: mql (lead qualificado) ou disqualified (lead ruim). Entrar na etapa envia QualifiedLead / DisqualifiedLead à Meta (regra automática) e, no mql, marca o contato como MQL.';

-- ── 2. A Meta passa a aceitar o evento de lead desqualificado ───────────────
alter table public.meta_ads_conversion_rules
  drop constraint if exists meta_ads_conversion_rules_evento_conhecido;
alter table public.meta_ads_conversion_rules
  add constraint meta_ads_conversion_rules_evento_conhecido
  check (meta_event in (
    'LeadSubmitted', 'QualifiedLead', 'DisqualifiedLead', 'InitiateCheckout', 'AddToCart',
    'ViewContent'
  ));

-- ── 3. O papel da etapa liga/desliga a regra da Meta sozinho ────────────────
create or replace function public.fn_sync_stage_qualification()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_evento text;
begin
  if tg_op = 'UPDATE' and new.qualification is not distinct from old.qualification then
    return new;
  end if;

  if new.qualification is not null then
    v_evento := case new.qualification when 'mql' then 'QualifiedLead' else 'DisqualifiedLead' end;
    insert into public.meta_ads_conversion_rules
      (organization_id, stage_id, event_name, meta_event, enabled)
    values
      (new.organization_id, new.id, 'MetaEtapa:' || new.id::text, v_evento, true)
    on conflict (organization_id, stage_id)
    do update set meta_event = excluded.meta_event, enabled = true;
  elsif tg_op = 'UPDATE' and old.qualification is not null then
    update public.meta_ads_conversion_rules
       set enabled = false
     where organization_id = new.organization_id
       and stage_id = new.id
       and meta_event in ('QualifiedLead', 'DisqualifiedLead');
  end if;
  return new;
end
$f$;

revoke execute on function public.fn_sync_stage_qualification() from public, anon, authenticated;

drop trigger if exists trg_sync_stage_qualification on public.crm_stages;
create trigger trg_sync_stage_qualification
  after insert or update of qualification on public.crm_stages
  for each row execute function public.fn_sync_stage_qualification();

-- ── 4. Entrar numa etapa MQL marca o contato como MQL ───────────────────────
create or replace function public.fn_lead_enters_mql_stage()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.contact_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;
  if exists (
    select 1 from public.crm_stages s
     where s.id = new.stage_id and s.qualification = 'mql'
  ) then
    update public.contacts
       set is_mql = true, mql_at = coalesce(mql_at, now())
     where id = new.contact_id
       and organization_id = new.organization_id
       and is_mql = false;
  end if;
  return new;
end
$f$;

revoke execute on function public.fn_lead_enters_mql_stage() from public, anon, authenticated;

drop trigger if exists trg_lead_enters_mql_stage on public.crm_leads;
create trigger trg_lead_enters_mql_stage
  after insert or update of stage_id on public.crm_leads
  for each row execute function public.fn_lead_enters_mql_stage();

-- ── 5. Modelos de funil ─────────────────────────────────────────────────────
create table if not exists public.demand_funnel_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  stages jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_funnel_templates_name_check check (length(btrim(name)) between 1 and 80),
  constraint demand_funnel_templates_stages_check
    check (jsonb_typeof(stages) = 'array' and jsonb_array_length(stages) between 1 and 40
           and pg_column_size(stages) <= 30000)
);

create unique index if not exists demand_funnel_templates_org_name_uk
  on public.demand_funnel_templates (organization_id, lower(name));

alter table public.demand_funnel_templates enable row level security;

drop policy if exists demand_funnel_templates_select on public.demand_funnel_templates;
create policy demand_funnel_templates_select on public.demand_funnel_templates
  for select using (
    ((organization_id in (select public.fn_user_org_ids()))
     and public.fn_role_at_least(organization_id, 'manager'))
    or public.fn_is_platform_admin()
  );
drop policy if exists demand_funnel_templates_write on public.demand_funnel_templates;
create policy demand_funnel_templates_write on public.demand_funnel_templates
  using (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin_full()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

revoke all on public.demand_funnel_templates from anon;
grant select, insert, update, delete on public.demand_funnel_templates to authenticated;

drop trigger if exists trg_demand_funnel_templates_updated_at on public.demand_funnel_templates;
create trigger trg_demand_funnel_templates_updated_at
  before update on public.demand_funnel_templates
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_funnel_templates is
  'Modelos de funil: as etapas (nome, papel, chance, janela, qualificação) de um funil, para a agência repetir em outras campanhas mudando só o nome.';

-- ── 6. Páginas opcionais da campanha ────────────────────────────────────────
alter table public.demand_campaigns
  add column if not exists optional_tabs text[];

alter table public.demand_campaigns drop constraint if exists demand_campaigns_optional_tabs_check;
alter table public.demand_campaigns add constraint demand_campaigns_optional_tabs_check
  check (optional_tabs is null
         or optional_tabs <@ array['landing', 'criativos', 'abordagem']::text[]);

comment on column public.demand_campaigns.optional_tabs is
  'Páginas opcionais que a campanha mostra (landing, criativos, abordagem). Nulo = o padrão do tipo de campanha.';

notify pgrst, 'reload schema';
