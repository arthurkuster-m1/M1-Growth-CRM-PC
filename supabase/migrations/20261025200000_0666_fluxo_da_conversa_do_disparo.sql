-- manifest: **O fluxo de conversa continua quando o lead responde.** `campaign_recipients.flow_state/flow_step/flow_wait_until/flow_stop_reason` dizem onde o fluxo da abordagem está para cada destinatário e `proposal_kind/proposal_body/proposal_ai` guardam a próxima mensagem proposta, que a pessoa aprova antes de sair.
alter table public.campaign_recipients
  add column if not exists flow_state text,
  add column if not exists flow_step integer,
  add column if not exists flow_wait_until timestamptz,
  add column if not exists flow_stop_reason text,
  add column if not exists proposal_kind text,
  add column if not exists proposal_body text,
  add column if not exists proposal_ai boolean not null default false;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_flow_state_check;
alter table public.campaign_recipients add constraint campaign_recipients_flow_state_check
  check (flow_state is null or flow_state in ('aguardando_resposta', 'proposta_pendente', 'concluido', 'encaminhado', 'parado'));
alter table public.campaign_recipients drop constraint if exists campaign_recipients_proposal_kind_check;
alter table public.campaign_recipients add constraint campaign_recipients_proposal_kind_check
  check (proposal_kind is null or proposal_kind in ('mensagem', 'audio'));
create index if not exists campaign_recipients_flow_idx
  on public.campaign_recipients (campaign_id, flow_state) where flow_state is not null;
comment on column public.campaign_recipients.flow_state is
  'Onde o fluxo de conversa da abordagem está para este destinatário: aguardando a resposta, proposta pendente de aprovação, concluído, encaminhado ao atendente ou parado. Nulo = o disparo não tem fluxo.';
notify pgrst, 'reload schema';
