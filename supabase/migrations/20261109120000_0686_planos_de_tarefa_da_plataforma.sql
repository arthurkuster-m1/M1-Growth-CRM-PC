-- manifest: adiciona task_plans (jsonb) à platform_branding — planos de tarefa da instalação, visíveis a todos os tenants como "Planos da agência"

alter table public.platform_branding
  add column if not exists task_plans jsonb;

comment on column public.platform_branding.task_plans is
  'Planos de tarefa da instalação — aparecem para todos os tenants como "Planos da agência", editáveis só pelo platform admin. Mesmo formato de organizations.settings.task_plans.';
