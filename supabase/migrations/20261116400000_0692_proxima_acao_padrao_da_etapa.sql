-- manifest: **Próxima ação padrão por etapa do funil.** `crm_stages.proxima_acao_padrao` (texto, até 300): o próximo passo que o lead recebe automaticamente ao entrar na etapa (ou ao nascer nela). Gatilho `trg_crm_leads_proxima_acao_padrao` (BEFORE INSERT/UPDATE OF stage_id) copia para `crm_leads.proxima_acao`, vale para qualquer caminho (arrastar, lote, IA, automação), zera o prazo do passo anterior e respeita um próximo passo escolhido na mesma escrita. Etapa com o campo vazio não muda nada. Aditiva e idempotente.

-- 0692 — PRÓXIMA AÇÃO PADRÃO DA ETAPA

alter table public.crm_stages
  add column if not exists proxima_acao_padrao text not null default '';

alter table public.crm_stages
  drop constraint if exists crm_stages_proxima_acao_padrao_len;
alter table public.crm_stages
  add constraint crm_stages_proxima_acao_padrao_len check (char_length(proxima_acao_padrao) <= 300);

comment on column public.crm_stages.proxima_acao_padrao is
  'Próximo passo que o lead recebe ao entrar nesta etapa (vazio = não mexe). Vira crm_leads.proxima_acao.';

create or replace function public.fn_crm_lead_proxima_acao_padrao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_padrao text;
begin
  if tg_op = 'UPDATE' then
    if new.stage_id is not distinct from old.stage_id then
      return new;
    end if;
    -- Quem mudou a etapa e já escolheu o próximo passo na mesma escrita manda mais que o padrão.
    if new.proxima_acao is distinct from old.proxima_acao then
      return new;
    end if;
  else
    if coalesce(btrim(new.proxima_acao), '') <> '' then
      return new;
    end if;
  end if;

  select btrim(proxima_acao_padrao) into v_padrao
    from public.crm_stages where id = new.stage_id;
  if coalesce(v_padrao, '') = '' then
    return new;
  end if;

  new.proxima_acao := v_padrao;
  -- O prazo do passo anterior não vale para o passo novo.
  if tg_op = 'UPDATE' and new.proxima_acao_em is not distinct from old.proxima_acao_em then
    new.proxima_acao_em := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_crm_lead_proxima_acao_padrao() from public, anon;

drop trigger if exists trg_crm_leads_proxima_acao_padrao on public.crm_leads;
create trigger trg_crm_leads_proxima_acao_padrao
  before insert or update of stage_id on public.crm_leads
  for each row execute function public.fn_crm_lead_proxima_acao_padrao();

notify pgrst, 'reload schema';
