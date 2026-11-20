-- manifest: **Central de avisos sem os tipos que ninguém cria.** Remove de `agent_inbox_items_kind_check` seis valores sem emissor em todo o código (medido em 20/11/2026: só existiam na lista do banco, no tipo TypeScript e nas tabelas de rótulo): `promotion_review`, `judge_unaligned`, `proposal_expired_notice`, `proposal_acceptance_rate_drop`, `proposal_promised_not_created` e `proposta_travada`. Antes de reconstruir a constraint, qualquer linha antiga com um desses valores vira `other` (o título e o corpo ficam como estão), para o ALTER nunca falhar num banco que tenha alguma. Remoção deliberada registrada em `tests/unit/migrations-nao-encolhem-vocabulario.test.ts`. Idempotente.

-- 0699 — CENTRAL SEM OS AVISOS MORTOS

update public.agent_inbox_items
   set kind = 'other'
 where kind in (
   'promotion_review', 'judge_unaligned',
   'proposal_expired_notice', 'proposal_acceptance_rate_drop', 'proposal_promised_not_created',
   'proposta_travada'
 );

-- Lista COMPLETA do bloco único do baseline (kind-check-migration-x-baseline):
-- esta passa a ser a última migration que reconstrói a constraint.
alter table public.agent_inbox_items
  drop constraint if exists agent_inbox_items_kind_check;
alter table public.agent_inbox_items
  add constraint agent_inbox_items_kind_check check (kind in (
    'appointment_outcome_required','appointment_recovery_review','qr_rescan','routing_unassigned',
    'job_dead','event_dead','budget_exceeded','handoff',
    'followup_dead','snooze_expired','next_action_ambiguous','risk_backlog_seeded',
    'reactivation_expired','capabilities_missing','message_send_stuck','midia_nao_lida',
    'channel_template_review','channel_number_alert','promise_unfulfilled','contact_proposal_expired',
    'budget_warning','conhecimento_nao_indexado','voice_call_missed','case_stale',
    'aviso_de_caso_nao_entregue','followup_sem_agente','canal_mudo_sem_numero',
    'proposta_pronta_para_revisao',
    'jev_pedido_de_humano',
    'jev_parar_de_receber',
    'org_reativada',
    'other'
  ));

notify pgrst, 'reload schema';
