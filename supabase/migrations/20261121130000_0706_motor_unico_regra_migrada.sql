-- manifest: **Motor único, passo 4c: a regra sabe para que fluxo foi migrada.** `automation_rules` ganha `migrated_to_pointer_id` (o fluxo `crm_automation` que a substituiu) e `migrated_was_active` (se estava ligada — o que o desfazer restaura). Só estrutura; a migração das regras é reversível e a regra original nunca é apagada. Idempotente.

-- 0706 — MOTOR ÚNICO, PASSO 4c: a regra sabe para que fluxo foi migrada
--
-- Só ESTRUTURA. A migração das regras para o motor único (`lib/followup/migrar-regras.ts`) é REVERSÍVEL e
-- nunca deixa regra e fluxo ativos ao mesmo tempo; para isso precisa lembrar, em cada regra:
--   · `migrated_to_pointer_id`: o fluxo `crm_automation` que a substituiu (NULL = nunca migrada);
--   · `migrated_was_active`: se a regra estava LIGADA quando foi migrada — é o que o "desfazer" restaura e o
--     que decide, numa segunda rodada interrompida no meio, se o fluxo ainda precisa ser publicado.
-- Apagar o fluxo solta o vínculo (`on delete set null`); a regra original nunca é apagada pela migração.
alter table public.automation_rules
  add column if not exists migrated_to_pointer_id uuid references public.followup_flow_pointers(id) on delete set null,
  add column if not exists migrated_was_active boolean;

create index if not exists idx_automation_rules_migrada
  on public.automation_rules (organization_id, migrated_to_pointer_id)
  where migrated_to_pointer_id is not null;

notify pgrst, 'reload schema';
