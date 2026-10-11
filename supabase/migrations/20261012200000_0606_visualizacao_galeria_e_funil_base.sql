-- manifest: **Tipo "galeria" nas visualizações salvas e funil padrão "Base Padrão - Clientes" para organizações novas.** `crm_saved_views.type` aceita `galeria` (os "Cards" das campanhas); `fn_seed_default_pipeline_for_org` passa a semear o funil "Base Padrão - Clientes" (Novo, Em andamento, Ganho, Perdido), padrão e funil de clientes, no lugar do funil de pedidos.

alter table public.crm_saved_views drop constraint if exists crm_saved_views_type_check;
alter table public.crm_saved_views add constraint crm_saved_views_type_check
  check (type in ('tabela', 'kanban', 'calendario', 'timeline', 'galeria'));

create or replace function public.fn_seed_default_pipeline_for_org()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pipeline_id uuid;
  v_position numeric := 1000;
  r record;
begin
  insert into public.crm_pipelines
    (organization_id, name, slug, description, is_default, is_client_pipeline, position)
  values
    (new.id, 'Base Padrão - Clientes', 'base-padrao-clientes',
     'Funil da base de clientes: onde nasce e fica o lead de quem já é cliente.',
     true, true, 1000)
  returning id into v_pipeline_id;

  for r in
    select * from (values
      ('Novo',         'novo',         false, false),
      ('Em andamento', 'em_andamento', false, false),
      ('Ganho',        'ganho',        true,  false),
      ('Perdido',      'perdido',      false, true)
    ) as t(stage_name, stage_slug, won, lost)
  loop
    insert into public.crm_stages (organization_id, pipeline_id, name, slug, position, is_won, is_lost)
    values (new.id, v_pipeline_id, r.stage_name, r.stage_slug, v_position, r.won, r.lost);
    v_position := v_position + 1000;
  end loop;

  return new;
end$$;

notify pgrst, 'reload schema';
