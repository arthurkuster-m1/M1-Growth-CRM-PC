-- manifest: **Propriedades personalizadas das tarefas.** `crm_task_properties`: as colunas que a organização cria (texto, número, seleção, seleção múltipla, data, caixa, link), cada uma com nome, tipo e — nas de seleção — a lista de opções; e `crm_tasks.custom_fields`, onde cada tarefa guarda o valor por id de propriedade. O tipo é validado pela rota; o banco garante a forma e o teto de tamanho.

-- ============================================================================
-- 0584 — PROPRIEDADES PERSONALIZADAS DAS TAREFAS
--
-- ─── O que o produto não tinha
--
-- As colunas da tabela de tarefas eram as que o produto decidiu: título, status,
-- prioridade, prazo, responsável, descrição. Quem usa o Notion cria as próprias
-- ("Cliente", "Canal", "Valor", "Entregue?") — e é exatamente o que um time comercial
-- faz com uma lista de trabalho. Esta migration dá o chão para isso.
--
-- ─── Por que definição numa tabela e valor num jsonb
--
-- A DEFINIÇÃO (nome, tipo, opções) é dado da organização, com dono, ordem e
-- unicidade: merece tabela, RLS e auditoria. O VALOR, por tarefa, é esparso — a
-- maioria das tarefas não preenche a maioria das propriedades — e `custom_fields
-- jsonb` é o padrão que o produto já usa para os negócios (CLAUDE.md, "Modelagem").
-- A pegadinha desse padrão é o "jsonb lock-in" (anti-pattern nº 6): a tela ler um
-- caminho que ninguém declarou. Aqui o esquema central é `crm_task_properties`, e a
-- rota valida cada valor contra o TIPO da propriedade antes de gravar.
--
-- ─── Apagar uma propriedade
--
-- Apaga a definição e a rota remove a chave de `custom_fields` das tarefas. Se a
-- remoção falhasse no meio, sobraria um valor órfão — inofensivo: nenhuma tela lê
-- uma chave sem definição.
-- ============================================================================

create table if not exists public.crm_task_properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  -- O tipo é imutável depois de criado: trocar "número" por "data" reinterpretaria o
  -- valor de todas as tarefas. Texto + CHECK, e não enum (CLAUDE.md).
  type text not null,
  -- Só as de seleção usam: [{ "id": "...", "name": "...", "color": "blue" }, ...].
  options jsonb not null default '[]'::jsonb,
  position numeric not null default extract(epoch from clock_timestamp()),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_task_properties_name_check
    check (length(btrim(name)) > 0 and length(name) <= 60),
  constraint crm_task_properties_type_check
    check (type in ('text','number','select','multi_select','date','checkbox','url')),
  constraint crm_task_properties_options_check
    check (jsonb_typeof(options) = 'array' and pg_column_size(options) <= 20000)
);

create unique index if not exists crm_task_properties_org_name_uniq
  on public.crm_task_properties (organization_id, lower(btrim(name)));

create index if not exists crm_task_properties_org_position_idx
  on public.crm_task_properties (organization_id, position);

alter table public.crm_task_properties enable row level security;

-- Leitura para a organização; escrita a partir de `manager` — definir o vocabulário da
-- operação é configuração, como as opções de status (0582).
drop policy if exists crm_task_properties_select on public.crm_task_properties;
create policy crm_task_properties_select on public.crm_task_properties
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists crm_task_properties_write on public.crm_task_properties;
create policy crm_task_properties_write on public.crm_task_properties
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

revoke all on public.crm_task_properties from anon;
grant select, insert, update, delete on public.crm_task_properties to authenticated;
grant all on public.crm_task_properties to service_role;

drop trigger if exists trg_crm_task_properties_updated_at on public.crm_task_properties;
create trigger trg_crm_task_properties_updated_at
  before update on public.crm_task_properties
  for each row execute function public.fn_set_updated_at();

comment on table public.crm_task_properties is
  'As propriedades (colunas) personalizadas das tarefas, por organização: nome, tipo imutável e, nas de seleção, a lista de opções. O VALOR de cada tarefa mora em crm_tasks.custom_fields, por id de propriedade, e é validado pela rota contra o tipo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Os valores, por tarefa
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.crm_tasks
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- A forma e o teto: objeto (nunca array nem escalar) e no máximo ~20 KB. A validade do
-- CONTEÚDO é da rota; isto só impede uma linha de virar depósito de arquivo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'crm_tasks_custom_fields_check'
       and conrelid = 'public.crm_tasks'::regclass
  ) then
    alter table public.crm_tasks
      add constraint crm_tasks_custom_fields_check
      check (jsonb_typeof(custom_fields) = 'object' and pg_column_size(custom_fields) <= 20000);
  end if;
end
$$;

comment on column public.crm_tasks.custom_fields is
  'Valor de cada propriedade personalizada, por id de crm_task_properties: { "<id>": valor }. Esparso por natureza. A rota valida cada valor contra o tipo da propriedade; chave sem definição é órfã e nenhuma tela a lê.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Apagar uma propriedade leva os valores dela embora
--
-- A rota apaga a DEFINIÇÃO primeiro e chama isto depois: se a limpeza falhar, sobram
-- chaves órfãs (inofensivas — nenhuma tela lê chave sem definição); no sentido
-- contrário, falharia o DELETE depois de os valores terem sumido, e a pessoa perderia
-- dado de uma propriedade que continua na tela. É função de quem chama (sem `security
-- definer`): o UPDATE passa pela policy `crm_tasks_write`, de `agent` para cima.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_tarefas_limpar_propriedade(p_org uuid, p_prop uuid)
returns integer
language sql
set search_path = public, pg_temp
as $$
  with limpas as (
    update public.crm_tasks
       set custom_fields = custom_fields - (p_prop::text)
     where organization_id = p_org
       and custom_fields ? (p_prop::text)
    returning 1
  )
  select count(*)::int from limpas;
$$;

revoke execute on function public.fn_tarefas_limpar_propriedade(uuid, uuid) from public, anon;
grant  execute on function public.fn_tarefas_limpar_propriedade(uuid, uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- LGPD: a anonimização do contato alcança também os valores personalizados
--
-- A 0210 já redige `title` e `description` das tarefas de um contato anonimizado.
-- Uma propriedade de texto ("Cliente", "Observação") é texto livre do mesmo jeito, e
-- deixá-la de fora faria a anonimização devolver sucesso com o nome da pessoa ainda
-- legível — o modo de falha que `tests/invariants/lgpd-cascata-alcanca-quem-guarda-
-- pessoa.test.ts` existe para pegar. Redefine a MESMA função da 0210 (mesmo gatilho,
-- mesmos grants) acrescentando `custom_fields`.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_redigir_tarefas_do_contato_anonimizado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.crm_tasks
     set title         = 'Tarefa anonimizada',
         description   = null,
         custom_fields = '{}'::jsonb
   where organization_id = new.organization_id
     and contact_id = new.id;
  return new;
end;
$$;

revoke execute on function public.fn_redigir_tarefas_do_contato_anonimizado() from public, anon, authenticated;
grant  execute on function public.fn_redigir_tarefas_do_contato_anonimizado() to service_role;

notify pgrst, 'reload schema';
