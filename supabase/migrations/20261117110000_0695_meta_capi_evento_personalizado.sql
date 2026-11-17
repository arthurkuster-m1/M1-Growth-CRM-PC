-- manifest: **Evento personalizado na Meta CAPI por etapa.** `meta_ads_conversion_rules.meta_event` deixa de ser lista fechada e passa a aceitar também um nome livre (letra inicial, letras/números/underscore, até 40 caracteres), para a etapa avisar a Meta com um evento próprio (ex.: `AgendouVisita`). Os padrões da Meta continuam valendo; a tela marca que evento personalizado não alimenta a otimização padrão. Aditiva e idempotente.

-- 0695 — EVENTO PERSONALIZADO NA META CAPI

alter table public.meta_ads_conversion_rules
  drop constraint if exists meta_ads_conversion_rules_evento_conhecido;
alter table public.meta_ads_conversion_rules
  add constraint meta_ads_conversion_rules_evento_conhecido
  check (meta_event ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$');

notify pgrst, 'reload schema';
