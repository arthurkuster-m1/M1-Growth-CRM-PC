-- manifest: **Mensagens da IA por destinatário, com aprovação.** `campaign_recipients.ai_status/ai_error/ai_cost_cents/ai_tokens` guardam a mensagem que a IA escreveu para cada lead (gerada, editada, falhou) e o custo; `campaigns.ai_approved_at/ai_approved_by` guardam a aprovação, sem a qual o disparo com mensagem da IA não inicia.
alter table public.campaign_recipients
  add column if not exists ai_status text,
  add column if not exists ai_error text,
  add column if not exists ai_cost_cents numeric,
  add column if not exists ai_tokens integer;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_ai_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_ai_status_check
  check (ai_status is null or ai_status in ('gerada', 'editada', 'falhou'));
alter table public.campaigns
  add column if not exists ai_approved_at timestamptz,
  add column if not exists ai_approved_by uuid references auth.users(id) on delete set null;
comment on column public.campaign_recipients.ai_status is
  'Mensagem escrita pela IA para este destinatário: gerada, editada (a pessoa mexeu) ou falhou. Nulo = texto fixo.';
comment on column public.campaigns.ai_approved_at is
  'Quando a pessoa aprovou as mensagens da IA deste disparo. Sem isso, um disparo com mensagem da IA não inicia. Zera ao regerar, editar ou preparar de novo.';
notify pgrst, 'reload schema';
