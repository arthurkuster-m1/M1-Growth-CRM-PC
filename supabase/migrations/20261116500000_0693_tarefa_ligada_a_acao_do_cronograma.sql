-- manifest: **Tarefas da semana ligadas às ações do cronograma.** `crm_tasks.cronograma_item_id` (uuid, nulo, `on delete set null`) aponta para `marketing_cronograma_itens`: a tarefa da semana passa a pertencer a uma ação-chave do cronograma geral. Apagar a ação solta a tarefa (não apaga). Aditiva e idempotente.

-- 0693 — TAREFA DA SEMANA LIGADA À AÇÃO DO CRONOGRAMA

alter table public.crm_tasks
  add column if not exists cronograma_item_id uuid
  references public.marketing_cronograma_itens(id) on delete set null;

create index if not exists crm_tasks_cronograma_item_idx
  on public.crm_tasks (cronograma_item_id)
  where cronograma_item_id is not null;

comment on column public.crm_tasks.cronograma_item_id is
  'A ação do cronograma geral a que esta tarefa da semana pertence (apagar a ação solta a tarefa, não a apaga).';

notify pgrst, 'reload schema';
