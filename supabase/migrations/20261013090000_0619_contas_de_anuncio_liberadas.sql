-- manifest: **Contas de anúncio liberadas por organização.** Um token de agência enxerga as contas de TODOS os clientes; sem trava, o gestor de um cliente listaria (e leria) a conta de outro. `ad_insights_connections.restrict_accounts` marca a conexão cujo token foi colocado pelo administrador da plataforma, e `allowed_account_ids` é a lista de contas (`act_…`) que aquela organização pode usar — só o administrador da plataforma edita. Conexão restrita com lista vazia não enxerga conta nenhuma (fail-closed). Conexões já existentes ficam restritas às contas que já usam.

alter table public.ad_insights_connections
  add column if not exists restrict_accounts boolean not null default false,
  add column if not exists allowed_account_ids text[] not null default '{}';

-- As conexões que já existem passam a valer só para as contas que elas já usam hoje.
update public.ad_insights_connections c
   set restrict_accounts = true,
       allowed_account_ids = coalesce((
         select array_agg(distinct a) from (
           select d.meta_account_id as a
             from public.demand_campaigns d
            where d.organization_id = c.organization_id
              and d.meta_account_id is not null and d.meta_account_id <> ''
           union
           select c.default_account_id
            where c.default_account_id is not null and c.default_account_id <> ''
         ) x
       ), '{}')
 where c.platform = 'meta_ads';

comment on column public.ad_insights_connections.restrict_accounts is
  'Token colocado pelo administrador da plataforma (agência): só as contas de `allowed_account_ids` valem. Token colocado pela própria empresa fica sem restrição (o token é só dela).';
comment on column public.ad_insights_connections.allowed_account_ids is
  'Contas de anúncio (act_<id>) que esta organização pode listar, escolher e ler. Editada só pelo administrador da plataforma.';

notify pgrst, 'reload schema';
