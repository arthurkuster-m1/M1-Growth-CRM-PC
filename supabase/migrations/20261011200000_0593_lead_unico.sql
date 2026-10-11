-- manifest: **Lead único.** Um contato tem no máximo UM negócio aberto por funil (`uniq_crm_leads_open_contact_pipeline`) e pode estar em vários funis; o contato ganha MQL (`is_mql`, `mql_at`, `mql_by`) e a data da primeira abordagem (`first_approached_at`, mantida por trigger na primeira mensagem de saída); entrar num funil põe a tag `Funil: <nome>` no contato (trigger, com preenchimento do que já existe).

-- ============================================================================
-- 0593 — LEAD ÚNICO (CRM, sessão 1)
--
-- Regra de produto: 1 contato = 1 lead. A mesma pessoa pode estar em vários funis, mas só uma
-- vez em cada um (aberta). Antes, o índice único foi evitado de propósito para permitir dois
-- negócios abertos criados à mão; a decisão agora é o contrário.
--
--  • índice: um aberto por (organização, contato, funil);
--  • contacts: MQL e primeira abordagem;
--  • trigger: a primeira mensagem de SAÍDA marca `first_approached_at`;
--  • trigger: entrar num funil carimba a tag "Funil: <nome>" no contato.
-- ============================================================================

alter table public.contacts
  add column if not exists is_mql boolean not null default false,
  add column if not exists mql_at timestamptz,
  add column if not exists mql_by uuid references auth.users(id) on delete set null,
  add column if not exists first_approached_at timestamptz;

comment on column public.contacts.is_mql is
  'Lead qualificado para marketing (MQL). Marcado à mão ou por regra de funil.';
comment on column public.contacts.mql_at is 'Quando foi marcado como MQL.';
comment on column public.contacts.first_approached_at is
  'Quando o contato foi abordado/atendido pela primeira vez: a primeira mensagem de SAÍDA (humano, IA ou campanha). Mantido por trigger.';

-- Um negócio ABERTO por contato em cada funil.
create unique index if not exists uniq_crm_leads_open_contact_pipeline
  on public.crm_leads (organization_id, contact_id, pipeline_id)
  where status = 'open' and contact_id is not null;

-- ── Primeira abordagem.
create or replace function public.fn_contact_first_approach()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.direction = 'outbound' then
    update public.contacts
       set first_approached_at = coalesce(new.sent_at, new.created_at, now())
     where id = new.contact_id
       and organization_id = new.organization_id
       and first_approached_at is null;
  end if;
  return new;
end
$f$;

drop trigger if exists trg_messages_first_approach on public.messages;
create trigger trg_messages_first_approach
  after insert on public.messages
  for each row execute function public.fn_contact_first_approach();

-- Preenche quem já foi abordado.
update public.contacts c
   set first_approached_at = m.primeira
  from (
    select contact_id, min(sent_at) as primeira
      from public.messages
     where direction = 'outbound'
     group by contact_id
  ) m
 where c.id = m.contact_id and c.first_approached_at is null;

-- ── Tag automática do funil.
create or replace function public.fn_lead_tag_do_funil()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_nome text;
  v_tag text;
begin
  if new.contact_id is null then return new; end if;
  select name into v_nome from public.crm_pipelines where id = new.pipeline_id;
  if v_nome is null then return new; end if;
  v_tag := left('Funil: ' || v_nome, 60);
  update public.contacts
     set tags = array_append(tags, v_tag)
   where id = new.contact_id
     and organization_id = new.organization_id
     and not (v_tag = any(tags));
  return new;
end
$f$;

drop trigger if exists trg_crm_leads_tag_do_funil on public.crm_leads;
create trigger trg_crm_leads_tag_do_funil
  after insert on public.crm_leads
  for each row execute function public.fn_lead_tag_do_funil();

-- Preenche o que já existe.
update public.contacts c
   set tags = c.tags || t.tags_novas
  from (
    select l.contact_id,
           array_agg(distinct left('Funil: ' || p.name, 60)) as tags_novas
      from public.crm_leads l
      join public.crm_pipelines p on p.id = l.pipeline_id
     where l.contact_id is not null
     group by l.contact_id
  ) t
 where c.id = t.contact_id
   and not (t.tags_novas <@ c.tags);

notify pgrst, 'reload schema';
