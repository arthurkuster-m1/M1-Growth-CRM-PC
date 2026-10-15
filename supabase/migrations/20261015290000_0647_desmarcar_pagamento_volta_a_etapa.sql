-- manifest: **Desmarcar o pagamento devolve a oportunidade à etapa de antes do Comprou.** Hoje a primeira parcela recebida leva a oportunidade a Comprou, mas desmarcar a parcela (voltar para prevista, cancelar ou apagar) deixava a oportunidade em Comprou. Agora a etapa de onde ela veio é guardada (`crm_leads.comprou_de_stage_id`) e, quando a última parcela recebida deixa de ser recebida, a oportunidade volta para essa etapa (ou para a primeira etapa aberta do funil, se a de antes não existe mais) e reabre. Marcar de novo leva a Comprou outra vez: o caminho de ida e volta passa pelo checkbox da parcela.

alter table public.crm_leads
  add column if not exists comprou_de_stage_id uuid references public.crm_stages(id) on delete set null;

create or replace function public.fn_crm_sale_payments_after_write()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
declare
  v_lead uuid := coalesce(new.lead_id, old.lead_id);
  v_ult date; v_contact uuid; v_org uuid;
  v_pipeline uuid; v_stage uuid; v_status text; v_stage_ganha boolean;
  v_volta uuid;
begin
  if v_lead is null then
    return coalesce(new, old);
  end if;
  select max(paid_on) filter (where status = 'recebida') into v_ult
    from public.crm_sale_payments where lead_id = v_lead;
  select contact_id, organization_id, pipeline_id, stage_id, status, comprou_de_stage_id
    into v_contact, v_org, v_pipeline, v_stage, v_status, v_volta
    from public.crm_leads where id = v_lead;
  if not found then
    return coalesce(new, old);
  end if;
  update public.crm_leads set paid_on = v_ult where id = v_lead and paid_on is distinct from v_ult;

  -- IDA: a primeira parcela recebida (mesmo um sinal) faz a oportunidade virar Comprou, e a etapa de
  -- onde ela veio fica guardada para o caminho de volta.
  if tg_op <> 'DELETE' and new.status = 'recebida' then
    perform set_config('m1.comprou_pelo_pagamento', 'on', true);
    update public.crm_leads l
       set comprou_de_stage_id = l.stage_id,
           stage_id = w.id
      from (
        select st.id, st.pipeline_id from public.crm_stages st
         where st.is_won and not st.is_archived
         order by st.position
      ) w
     where l.id = v_lead and l.status = 'open' and w.pipeline_id = l.pipeline_id;
    perform set_config('m1.comprou_pelo_pagamento', 'off', true);

  -- VOLTA: não restou nenhuma parcela recebida e a oportunidade está em Comprou.
  elsif v_status = 'won'
        and not exists (
          select 1 from public.crm_sale_payments p where p.lead_id = v_lead and p.status = 'recebida'
        ) then
    select is_won into v_stage_ganha from public.crm_stages where id = v_stage;
    if coalesce(v_stage_ganha, false) then
      -- A etapa de antes (se ainda existe, aberta e do mesmo funil) ou a primeira etapa aberta.
      select s.id into v_volta
        from public.crm_stages s
       where s.id = v_volta and s.pipeline_id = v_pipeline
         and not s.is_won and not s.is_lost and not s.is_archived;
      if v_volta is null then
        select s.id into v_volta
          from public.crm_stages s
         where s.pipeline_id = v_pipeline and not s.is_won and not s.is_lost
           and not s.is_archived and s.qualification is null
         order by s.position
         limit 1;
      end if;
      if v_volta is not null then
        -- Mover para uma etapa aberta reabre (status open, sem data de fechamento).
        update public.crm_leads
           set stage_id = v_volta, comprou_de_stage_id = null, won_reason = null
         where id = v_lead;
      end if;
    end if;
  end if;

  if v_contact is not null then
    perform public.fn_crm_sales_refresh_contact(v_org, v_contact);
    perform public.fn_contato_recalcula_ciclo(v_org, v_contact);
  end if;
  return coalesce(new, old);
end
$f$;
