-- manifest: **Modelos de criativo e criativo planejado.** `demand_creative_templates` guarda o criativo pronto (5 legendas, 5 títulos, 5 descrições, link, design) com uma tag que se troca pela cidade; o criativo ganha o status `planejado` e o `design_url`, e a importação do Meta completa o planejado de mesmo nome.

alter table public.demand_campaign_creatives drop constraint if exists demand_campaign_creatives_status_check;
alter table public.demand_campaign_creatives add constraint demand_campaign_creatives_status_check
  check (status in ('planejado', 'ativo', 'pausado', 'encerrado'));

alter table public.demand_campaign_creatives add column if not exists design_url text not null default '';
alter table public.demand_campaign_creatives drop constraint if exists demand_campaign_creatives_design_check;
alter table public.demand_campaign_creatives add constraint demand_campaign_creatives_design_check
  check (length(design_url) <= 1000);

create table if not exists public.demand_creative_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tag text not null default 'TROCACITY',
  format text not null default 'imagem',
  headlines jsonb not null default '[]'::jsonb,
  bodies jsonb not null default '[]'::jsonb,
  descriptions jsonb not null default '[]'::jsonb,
  link_url text not null default '',
  design_url text not null default '',
  notes text not null default '',
  position numeric not null default extract(epoch from clock_timestamp()),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demand_creative_templates_name_check check (length(btrim(name)) between 1 and 160),
  constraint demand_creative_templates_tag_check check (length(btrim(tag)) between 2 and 40),
  constraint demand_creative_templates_format_check check (format in ('imagem', 'video', 'carrossel', 'outro')),
  constraint demand_creative_templates_texts_check
    check (length(link_url) <= 1000 and length(design_url) <= 1000 and length(notes) <= 2000
           and jsonb_typeof(headlines) = 'array' and jsonb_typeof(bodies) = 'array'
           and jsonb_typeof(descriptions) = 'array')
);

create index if not exists demand_creative_templates_org_idx
  on public.demand_creative_templates (organization_id, position);

alter table public.demand_creative_templates enable row level security;

drop policy if exists demand_creative_templates_select on public.demand_creative_templates;
create policy demand_creative_templates_select on public.demand_creative_templates
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );
drop policy if exists demand_creative_templates_write on public.demand_creative_templates;
create policy demand_creative_templates_write on public.demand_creative_templates
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

revoke all on public.demand_creative_templates from anon;
grant select, insert, update, delete on public.demand_creative_templates to authenticated;

drop trigger if exists trg_demand_creative_templates_updated_at on public.demand_creative_templates;
create trigger trg_demand_creative_templates_updated_at
  before update on public.demand_creative_templates
  for each row execute function public.fn_set_updated_at();

comment on table public.demand_creative_templates is
  'Modelos de criativo da empresa: textos e design prontos com uma tag que se troca pela cidade do evento. Lidos pela empresa toda; escritos a partir de manager.';

notify pgrst, 'reload schema';
