-- manifest: **Meta Ads automático nas campanhas de demanda (C3).** `demand_campaigns` ganha `meta_account_id` (a conta de anúncio do Meta), `meta_synced_at` e `meta_sync_error` (última sincronização do dia a dia e o motivo da falha, se houve).

alter table public.demand_campaigns
  add column if not exists meta_account_id text not null default '',
  add column if not exists meta_synced_at timestamptz,
  add column if not exists meta_sync_error text not null default '';

alter table public.demand_campaigns
  drop constraint if exists demand_campaigns_meta_check;
alter table public.demand_campaigns
  add constraint demand_campaigns_meta_check
  check (length(meta_account_id) <= 40 and length(meta_sync_error) <= 60);

comment on column public.demand_campaigns.meta_account_id is
  'Conta de anúncio do Meta (act_<id>) de onde vêm as campanhas atreladas. Vazio = a conta padrão da conexão.';
comment on column public.demand_campaigns.meta_synced_at is
  'Quando o dia a dia desta campanha foi sincronizado com o Meta pela última vez (sucesso).';
comment on column public.demand_campaigns.meta_sync_error is
  'Código curto da última falha de sincronização com o Meta (token_invalido, limite_de_chamadas…); vazio = sem falha.';

notify pgrst, 'reload schema';
