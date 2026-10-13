-- manifest: **Apagar campanha apaga o funil dela.** Funil só existe atrelado a uma campanha: ao apagar a campanha, o funil criado para ela é apagado junto e os leads que estavam nele passam para o funil escolhido (etapa de mesmo tipo: aberta, ganha ou perdida). Funil padrão ou usado por outra campanha não é apagado. `fn_demand_campaign_apagar_previa` diz quantos leads precisam de destino; `fn_demand_campaign_apagar` faz a mudança (só `service_role`, depois da autorização da rota).

create or replace function public.fn_demand_campaign_apagar_previa(p_org uuid, p_campaigns uuid[])
returns table (pipeline_id uuid, leads integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select c.pipeline_id,
         (select count(*)::integer from public.crm_leads l
           where l.organization_id = p_org and l.pipeline_id = c.pipeline_id)
    from public.demand_campaigns c
    join public.crm_pipelines p on p.id = c.pipeline_id and p.organization_id = p_org
   where c.organization_id = p_org
     and c.id = any (p_campaigns)
     and c.pipeline_id is not null
     and not p.is_default
     and not exists (
       select 1 from public.demand_campaigns o
        where o.organization_id = p_org and o.pipeline_id = c.pipeline_id
          and not (o.id = any (p_campaigns)))
   group by c.pipeline_id
$$;
revoke all on function public.fn_demand_campaign_apagar_previa(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.fn_demand_campaign_apagar_previa(uuid, uuid[]) to service_role;

create or replace function public.fn_demand_campaign_apagar(p_org uuid, p_campaigns uuid[], p_destino uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  r record;
  v_movidos integer := 0;
  v_n integer;
  v_funis_apagados integer := 0;
  v_apagadas integer;
  v_precisa boolean := false;
begin
  -- Há lead a mover? Então o destino é obrigatório e precisa ser um funil que continua existindo.
  for r in select * from public.fn_demand_campaign_apagar_previa(p_org, p_campaigns) loop
    if r.leads > 0 then v_precisa := true; end if;
  end loop;
  if v_precisa then
    if p_destino is null then
      raise exception 'destino_obrigatorio' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.crm_pipelines d
                    where d.id = p_destino and d.organization_id = p_org and not d.is_archived)
       or exists (select 1 from public.fn_demand_campaign_apagar_previa(p_org, p_campaigns) x
                   where x.pipeline_id = p_destino) then
      raise exception 'destino_invalido' using errcode = 'P0001';
    end if;
  end if;

  for r in select * from public.fn_demand_campaign_apagar_previa(p_org, p_campaigns) loop
    if r.leads > 0 then
      update public.crm_leads l
         set pipeline_id = p_destino,
             lost_from_stage_id = null,
             stage_id = coalesce(
               (select s.id from public.crm_stages s
                 where s.pipeline_id = p_destino and not s.is_archived
                   and case l.status when 'won' then s.is_won when 'lost' then s.is_lost
                                     else (not s.is_won and not s.is_lost) end
                 order by s.position limit 1),
               (select s.id from public.crm_stages s
                 where s.pipeline_id = p_destino and not s.is_archived
                   and not s.is_won and not s.is_lost
                 order by s.position limit 1))
       where l.organization_id = p_org and l.pipeline_id = r.pipeline_id;
      get diagnostics v_n = row_count;
      v_movidos := v_movidos + v_n;
    end if;
  end loop;

  for r in select * from public.fn_demand_campaign_apagar_previa(p_org, p_campaigns) loop
    -- As campanhas saem primeiro (a ligação com o funil vira nula) e depois o funil.
    delete from public.demand_campaigns
     where organization_id = p_org and id = any (p_campaigns) and pipeline_id = r.pipeline_id;
    delete from public.crm_pipelines where id = r.pipeline_id and organization_id = p_org;
    v_funis_apagados := v_funis_apagados + 1;
  end loop;

  delete from public.demand_campaigns where organization_id = p_org and id = any (p_campaigns);
  get diagnostics v_apagadas = row_count;

  return jsonb_build_object('leads_movidos', v_movidos, 'funis_apagados', v_funis_apagados,
                            'campanhas_apagadas', v_apagadas);
end
$$;
revoke all on function public.fn_demand_campaign_apagar(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.fn_demand_campaign_apagar(uuid, uuid[], uuid) to service_role;

notify pgrst, 'reload schema';
