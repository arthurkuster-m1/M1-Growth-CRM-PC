-- manifest: **Ao ganhar, o lead entra em outro funil.** Funil com `settings.ao_ganhar_funil_id` faz o contato que ganhou um negócio entrar (aberto, na primeira etapa) no funil de destino — trigger em `crm_leads`, então vale para a tela, o agente e as ações em lote; o lead permanece no funil de origem como ganho.

-- ============================================================================
-- 0594 — AO GANHAR, ENTRA EM OUTRO FUNIL (CRM, sessão 2)
--
-- "O lead permanece no CRM; só entra em um novo funil e ganha uma venda no histórico."
-- O destino é uma configuração do FUNIL de origem (`crm_pipelines.settings.ao_ganhar_funil_id`).
-- Vive em trigger porque o negócio pode ser ganho por quatro caminhos (quadro, agente,
-- lote, encerramento) e todos terminam num UPDATE de `status` em `crm_leads`.
--
-- Não duplica: se o contato já tem negócio ABERTO no destino, nada acontece (o índice único
-- `uniq_crm_leads_open_contact_pipeline` é a rede de segurança).
-- ============================================================================

create or replace function public.fn_lead_ganhou_entra_no_funil()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_destino uuid;
  v_etapa uuid;
  v_pos numeric;
begin
  if new.contact_id is null then return new; end if;

  select nullif(settings->>'ao_ganhar_funil_id', '')::uuid
    into v_destino
    from public.crm_pipelines
   where id = new.pipeline_id and organization_id = new.organization_id;
  if v_destino is null or v_destino = new.pipeline_id then return new; end if;

  -- O destino tem de ser da MESMA organização e estar vivo.
  if not exists (
    select 1 from public.crm_pipelines
     where id = v_destino and organization_id = new.organization_id and not is_archived
  ) then return new; end if;

  -- Já está aberto lá: nada a fazer.
  if exists (
    select 1 from public.crm_leads
     where organization_id = new.organization_id and contact_id = new.contact_id
       and pipeline_id = v_destino and status = 'open'
  ) then return new; end if;

  select id into v_etapa
    from public.crm_stages
   where organization_id = new.organization_id and pipeline_id = v_destino
     and not is_archived and not is_won and not is_lost
   order by position asc limit 1;
  if v_etapa is null then return new; end if;

  select coalesce(max(position_in_stage), 0) + 1000 into v_pos
    from public.crm_leads where stage_id = v_etapa;

  insert into public.crm_leads
    (organization_id, pipeline_id, stage_id, contact_id, title, source, source_metadata,
     position_in_stage, tags)
  values
    (new.organization_id, v_destino, v_etapa, new.contact_id, new.title, 'ganho',
     jsonb_build_object('origem_lead_id', new.id, 'origem_funil_id', new.pipeline_id),
     v_pos, '{}'::text[]);
  return new;
end
$f$;

drop trigger if exists trg_crm_leads_ganhou_entra_no_funil on public.crm_leads;
create trigger trg_crm_leads_ganhou_entra_no_funil
  after update on public.crm_leads
  for each row
  when (old.status is distinct from new.status and new.status = 'won')
  execute function public.fn_lead_ganhou_entra_no_funil();

notify pgrst, 'reload schema';
