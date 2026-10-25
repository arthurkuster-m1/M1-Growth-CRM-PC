-- manifest: **Custo da IA da continuação da conversa.** `campaign_recipients.flow_cost_cents/flow_tokens` acumulam o que a IA gastou escrevendo as mensagens seguintes à abertura de cada lead (a abertura segue em `ai_cost_cents/ai_tokens`).
alter table public.campaign_recipients
  add column if not exists flow_cost_cents numeric,
  add column if not exists flow_tokens integer;

comment on column public.campaign_recipients.flow_cost_cents is
  'Custo acumulado da IA nas mensagens da continuação da conversa deste lead (a abertura fica em ai_cost_cents).';

notify pgrst, 'reload schema';
