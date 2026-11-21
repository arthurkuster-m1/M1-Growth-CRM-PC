# PLANO — Motor único de automações (decisão de 20/11/2026)

> Continuação de [`PLANO-AUTOMACOES-M1.md`](PLANO-AUTOMACOES-M1.md) (frente 19, fase 6 antecipada). Lá estão inventário, categorias e proteções, que continuam valendo.


Decisão do Arthur (20/11/2026): **um motor só**, diagrama como tela, clientes **criam** automações; só **ligam/desligam** as que o Arthur montar (modelos). Ainda não há dados reais de clientes — pode-se migrar e quebrar com segurança (backup antes).

## 1. Como é hoje (duas máquinas)

| | Motor de **regras** | Motor de **follow-up** (grafo) |
|---|---|---|
| Código | `lib/automation/engine.ts` (489 linhas) | `lib/followup/engine.ts` (1294) + `node-handlers.ts` (913) |
| Tabelas | `automation_rules`, `automation_rule_runs` | `followup_flow_pointers` (+`surface`), `followup_flow_versions`, `followup_enrollments`, `followup_enrollment_events` |
| Forma | linear: gatilho → condições → ações | grafo: espera, condição, ramos, repetir, IA classifica |
| Disparo | evento do `event_log` (≈22 gatilhos) | `trigger_config.kind` (manual, webhook, lead_created, stage_change, silence, appointment_no_show, case_opened, conversation_end…) |
| Sujeito | evento (lead, contato, agenda) | **contato** (`contact_id` obrigatório) |
| Ações | 9: criar/mover lead, WhatsApp, IA, tag, atribuir, webhook, fluxo de mensagem, tarefa, plano de tarefas (+ `ai_decide`) | nós: action, internal_task, move_lead, edit_lead_tag, wait, … |
| Tela | sidebar `RuleEditor.tsx` (817 linhas) | diagrama React Flow (`app/app/ai/followups/[id]`) |
| Versão/publicar | não | sim (rascunho, publicar, rollback, validação) |

## 2. Decisão de arquitetura

**O motor de grafo do follow-up vira o motor único.** Motivos: já tem versões, publicar/rollback, esperas, ramos, fila com claim atômico, histórico por inscrição, validador de publicação e o editor visual. E **já nasceu preparado**: `followup_flow_pointers.surface` aceita `crm_automation` (migration 0196) e `validate-publish.ts` já lista os nós permitidos nessa superfície.

Portanto **não se cria motor novo**: generaliza-se o existente e as regras migram para ele.

Lacunas a fechar (o trabalho real):
1. **Gatilhos por evento**: o grafo só tem ~9 gatilhos; faltam os do motor de regras (lead ganho/perdido/reaberto/atribuído, tag adicionada, mensagem recebida/falhou, agenda criada/confirmada/remarcada/cancelada/compareceu/faltou, aniversário, data do funil, etapa parada…). Novo `trigger_config.kind = "event"` com `event_type` + filtros.
2. **Sujeito do fluxo**: `followup_enrollments.contact_id` é obrigatório; vários eventos têm lead sem contato. Decidir: adicionar `lead_id`/`subject_kind` ou exigir contato (verificar quantos leads têm `contact_id` nulo antes).
3. **Nós de ação que faltam**: enviar WhatsApp fixo, mensagem escrita pela IA, atribuir atendente, chamar webhook, criar/mover lead, iniciar fluxo de mensagem, aplicar plano de tarefas, "IA decide". Cada um **reutiliza** a ação existente em `lib/automation/actions/` (nada reescrito).
4. **Condições**: reaproveitar `lib/automation/conditions.ts` no nó `condition` (campos de lead/contato/tags/UTM).
5. **Migração de dados**: converter cada `automation_rules` em pointer `crm_automation` + versão (gatilho → condição → ações encadeadas), idempotente, com rollback. Depois desligar o consumidor `automation-rules` do dispatcher e aposentar a aba/tabela.
6. **Visibilidade**: histórico de execuções unificado (`followup_enrollment_events`) na tela da automação.
7. **Modelos**: `modelos-prontos.ts` e `modelos-de-tag.ts` viram grafos prontos ("instalar modelo" = criar cópia no rascunho). Liga/desliga para quem só usa modelos (papéis: gerente cria; atendente liga/desliga).

## 3. Telas

- `/app/automacoes`: grade de cartões (nome, resumo do fluxo em 1 linha, tipo, ligado/desligado, execuções), filtros por tipo, "Nova automação" → galeria de modelos ou em branco. Lista unifica `followup`, `crm_automation` e (somente leitura) as automações de sistema (aniversário, lembrete de agenda…).
- `/app/automacoes/[id]`: o diagrama (reuso de `FlowCanvas`/`FlowBuilder`), painel de edição **só do passo clicado**, Ligar/Desligar, Testar (modo teste sem envio real), histórico daquela automação. **Sem sidebar de regra.**
- Linguagem: Quando / Se / Então / Esperar; sem "trigger", "webhook" ou "payload" na cara.

## 4. Fases (uma por vez, testando cada uma)

0. **Sondagem (sem mudar nada):** leads sem contato? quais gatilhos do `event_log` o grafo consegue cobrir? como o worker `followup-flow-worker` e o dispatcher entregam evento ao motor? → atualiza este plano.
1. **Diagrama das regras atuais (só leitura)** na tela nova, convertendo regra → grafo em memória (`regraParaGrafo`). Valida o conversor antes de gravar qualquer coisa.
2. **Gatilho `event`** + sujeito (decisão 2) no motor de grafo, com migration (arquivo + apêndice no `baseline.sql`) e testes.
3. **Nós de ação** reaproveitando `lib/automation/actions/*` + nó de condição com `conditions.ts`.
4. **Migração das regras** para `crm_automation`, execução em paralelo (sombra) comparando resultados, depois virar a chave.
5. **Tela `/app/automacoes/[id]`** com edição por clique; lista nova em cartões; galeria de modelos.
6. **Follow-ups e automações de sistema entram na mesma lista.**
7. **Liberação aos clientes:** papéis (criar x ligar/desligar), limites por plano, aviso de custo de IA, modo teste, textos, remover "Em breve", porta em `catalogo.ts`, i18n pt/es.
8. **Aposentadoria** do motor de regras (consumidor, aba Regras, tabelas) após período sem uso.

## 5. Regras de segurança do trabalho

- Backup/export de `automation_rules` antes da fase 4. Nada destrutivo em banco sem pedir.
- Toda migration: arquivo `<timestamp>_<NNNN>_<slug>.sql` (próximo após 0700) **e** apêndice idempotente no `baseline.sql`; função nova em `public` com `revoke execute ... from public, anon`.
- RLS e `organization_id` em tudo; rotas mutantes com `requireRole` + `requireSupportWrite(` + `audit()` + Zod.
- Telas existentes (follow-up, regras) seguem funcionando até a fase 8.

## 6. Resultado da Fase 0 — sondagem (20/11/2026, nada foi alterado no código)

**Achados, com arquivo:**
1. **O follow-up é preso à conversa.** `followup_enrollments` exige `contact_id` e carrega uma `service_boundary` (contato + conversa + revisão; `lib/atendimento/fronteira.ts`). Se a conversa muda de rumo, o fluxo é descartado como "origem obsoleta" (`stale_origin`). Já as regras agem sobre **evento** (lead, agenda, aniversário) e abrem/reabrem a conversa só na hora de enviar (`lib/automation/start-conversation.ts`, `serviceForAutomation`).
2. **Lead pode ficar sem contato.** `crm_leads.contact_id` é anulável (`ON DELETE SET NULL`). Hoje o gatilho de lead criado conta esses casos como `sem_contato` e **pula** (`lib/followup/gatilho-lead.ts`). Não medi quantos existem (ainda não há dados reais; consulta ao banco não foi feita).
3. **Cada gatilho do follow-up tem o seu próprio handler** no dispatcher (`gatilho-lead`, `gatilho-etapa`, `gatilho-caso`, `gatilho-retorno`, `gatilho-presenca` + varredura de silêncio no cron). Não existe um "gatilho por evento" genérico. As regras, ao contrário, assinam todos os ~20 eventos num handler só (`lib/automation/engine.handler.ts`).
4. **Cobertura de gatilhos hoje no grafo:** cobre lead criado, mudou de etapa (só para **uma** etapa escolhida), faltou ao compromisso, silêncio e retorno depois de silêncio. **Não cobre** ganho, perdido, reaberto, responsável mudou, tag no lead/contato, mensagem recebida/falhou, horário marcado/confirmado/remarcado/cancelado/compareceu, aniversário, data do funil e etapa parada. São **15 de 20**.
5. **`surface='crm_automation'` existe só no papel:** o banco aceita e `validate-publish.ts` lista os nós, mas nenhuma tela ou rota cria fluxo nessa superfície.
6. **Ações já seguem uma cadeia de proteção** (janela do canal, limite diário, ritmo, trava de contato pessoal, agenda) em `lib/automation/actions/*`. Os nós novos precisam **chamar essas mesmas ações**, não reescrever o envio.

**Decisão técnica que isso força (a mais importante do projeto):** o sujeito do fluxo não pode ser sempre "contato + conversa".
- **Proposta:** na superfície `crm_automation`, a inscrição guarda o **sujeito do evento** (`subject_kind` + `subject_id`: lead, contato ou compromisso), com `contact_id` e `conversation_id` **opcionais**. A conversa só é aberta/validada quando um nó **envia mensagem** (reaproveitando `serviceForAutomation`).
- A superfície `followup` fica como está (continua presa à conversa). Assim nada do que já roda quebra.
- Exige migration (colunas novas + relaxar a restrição só para `crm_automation`), com apêndice no `baseline.sql`.

**Plano ajustado:**
- **Fase 1** (diagrama só de leitura das regras) segue igual.
- **Fase 2** passa a ser: migration do sujeito + **um handler único de eventos** para `crm_automation` (pode reaproveitar a lista de `TRIGGER_EVENTS`), que inscreve o fluxo no sujeito do evento.
- Os gatilhos por tempo (N dias sem mensagem, etapa parada, data do funil, aniversário) continuam sendo emitidos pelos crons atuais como evento; o handler único só os consome.
- Fases 3 a 8 sem mudança.

**Pergunta ao Arthur (não bloqueia a Fase 1):** podemos migrar as regras mesmo que, no começo, as automações de leads **sem contato** só façam passos internos (tag, tarefa, mover etapa) e peçam um contato para qualquer mensagem? É o que as regras de hoje já fazem.

## 7. Fase 2 — dividida em três (20/11/2026)
O motor de follow-up inteiro lê o lead **a partir do contato** (`lib/followup/engine.ts`, ~50 usos de `contact_id`). Trocar isso de uma vez é arriscado, então a Fase 2 vai em três passos, cada um deixando o sistema como está:
- **2a — banco (feita):** migration 0703. `followup_enrollments` ganha `subject_kind`/`subject_id`/`source_event_id`; `contact_id` aceita NULL, mas o trigger só permite em `surface='crm_automation'` (nenhuma tela cria ainda). Índice único de um fluxo vivo por (fluxo, sujeito). Provada num Postgres temporário: aplica 2x, follow-up sem contato é recusado, duplicado vivo é recusado, reinscrever após concluir funciona. **Não aplicada em nenhum banco real** (`lib/database.types.ts` também não foi regenerado — depende de aplicar).
- **2b — motor sabe o sujeito (feita, 20/11/2026):** o engine passa a carregar lead/contato pelo sujeito quando `contact_id` é nulo; envio abre a conversa na hora (`serviceForAutomation`). Sem isto, inscrição sem contato não pode rodar.
- **2c — handler único + gatilho `event` (feita, 20/11/2026):** consome os eventos de `TRIGGER_EVENTS`, inscreve no sujeito do evento, e o publicar passa a aceitar o gatilho.

**Como a 2b ficou** (`lib/followup/sujeito-do-fluxo.ts`, `engine.ts`, `node-handlers.ts`, `turn-bridge.ts`, `relogio/executar.ts`):
- Fluxo sem contato **não confere** fronteira de atendimento nem agenda (só fazem sentido com conversa) e **não é considerado** pelo relógio de resposta de contato.
- Fatos do lead vêm do sujeito (`loadLeadFactsDoSujeito`); os nós **tag, mover etapa e tarefa** acham o lead pelo sujeito (`negocioDoItem`, sempre filtrando `organization_id`).
- Nós que falam com o cliente ou esperam resposta (`action`, `ai_classify`, `match_reply`, `collect`, `skill`) falham de forma **controlada** com `fluxo_sem_contato` (tentativas, depois morte com aviso na Central) — o envio por automação, abrindo a conversa na hora, é a **Fase 3**.
- Testes novos: `tests/unit/fluxo-sem-contato-no-motor.test.ts` (5). Controle: fluxo com contato segue conferindo fronteira, agenda e fatos pelo contato.
- Regressão: a suíte `tests/unit` tem 142 testes vermelhos **antes e depois** (mesma lista, nenhum novo), todos em outras áreas. Um deles, `varredura-anon-e-o-ultimo-bloco`, já listava 16 funções criadas depois do bloco de anon no baseline e agora lista 17 (a função do trigger da 0703; ela revoga `anon` explicitamente).
- Ainda não revisado: telas e rotas que listam inscrições (fila de follow-up) assumem contato; ficam para quando existir fluxo `crm_automation` de verdade (2c).

**Como a 2c ficou** (`lib/followup/gatilho-evento.ts`, `gatilho-evento.handler.ts`, `api-schemas.ts`, publicar):
- Novo gatilho `trigger_config.kind='event'` com `params: { event_type, conditions[] }` (as condições são as mesmas das regras: campo/operador/valor). **Só vale em `surface='crm_automation'`**; o publicar recusa em qualquer outra superfície e recusa `params` inválido.
- Um handler (`followup-gatilho-evento.v1`) assina os mesmos 20 eventos das regras e inscreve o fluxo **no sujeito do evento** (lead, contato ou compromisso), sem contato nem conversa, com `source_event_id`. Reaproveita as guardas do motor de regras: anti-laço (`caused_by_rule`, `rule:` e `followup:`), entidade esperada por gatilho (sem rodar 2x o mesmo fato), canal desativado, contato pessoal e condições.
- Evento "dirigido a uma regra" (`payload.rule_id`, varredura da data do funil) **não casa aqui**: é das regras antigas até a Fase 4. **Os gatilhos por tempo** (N dias sem mensagem, etapa parada, data do funil, aniversário) vêm dos crons atuais e precisam ser tratados na Fase 4 (hoje o cron aponta para uma regra, não para um fluxo).
- Organização parada: o handler **pula** (como os outros gatilhos).
- Um fluxo vivo por (fluxo, sujeito): o mesmo evento repetido enquanto o fluxo roda não duplica.
- Guardas do repositório atendidas: `next_eval_at` fica a cargo do relógio do banco; o seletor de gatilho do follow-up **não** oferece `event` (exceção escrita em `tests/unit/gatilhos-oferecidos-tem-motor.test.ts`, que reprova a entrada quando a tela passar a oferecê-lo — Fase 5); `EVENTOS_DO_CRM` em `vocabulario.ts` espelha os rótulos das regras, com teste de não divergência.
- **Ainda nenhum fluxo `crm_automation` existe** (nenhuma tela ou rota cria), então nada muda para ninguém hoje. Quem o cria até a Fase 5 é a API.

## 8. Fase 3 — nós de ação (feita, 21/11/2026)
**Decisão de desenho:** UM tipo de nó, `crm_action`, cujo config é a **ação inteira no formato das regras** (`{ action: { type, config } }`), validada pelo mesmo `actionSchema` (inclui `ai_decide`). Em vez de 9 nós novos (e 9 formulários, 9 visuais...), todas as ações das regras viram o mesmo nó; uma regra migrada (Fase 4) vira nó sem traduzir formato.

**Como roda** (`lib/followup/acao-de-crm.ts`, `engine.ts`):
- Executa a **mesma ação registrada** em `lib/automation/actions/` (WhatsApp, IA, tag, atribuir, webhook, criar/mover lead, tarefa, plano de tarefas, iniciar fluxo de mensagem, "a IA decide"), com o contexto que elas esperam: o **evento de origem** relido do `event_log` (filtrando a organização), lead/contato hidratados por `buildContext`, `ruleId = followup:<inscrição>` (marca anti-laço), `actionIndex` e lista de ações **na ordem do grafo** (compõem o id da entrega do webhook).
- Janela do canal, limite diário, ritmo, trava de contato pessoal, consentimento e a **conversa aberta na hora de enviar** continuam vivendo nas ações — nada de envio foi reescrito.
- **Adiamento:** antes do passo o motor pergunta à ação (`postponeUntil`). Se pede para esperar, **não executa, não avança**, grava `crm_action_adiada` e reagenda para a hora pedida (avançar daria como feito um envio que não saiu).
- **Execução** depois do evento do passo (a trava de idempotência): replay do tick não manda duas vezes (na dúvida, nunca duas). O **resultado** vai para o histórico (`crm_action_result`: sucesso, pulou ou falhou, com o motivo) e o fluxo segue mesmo se a ação falhou, como as regras seguem para a próxima.
- **Publicar:** `crm_action` só vale em `surface='crm_automation'`; ação que reabriria o próprio gatilho (`assign_owner`/`create_or_move_lead` nos gatilhos do trigger do banco) é recusada com `acao_fecha_laco` — o mesmo veto da API das regras; na execução há a mesma defesa em profundidade.
- Vocabulário: `ACOES_DO_CRM` e `ALVOS_DA_TAG` em `vocabulario.ts`, com teste de não divergência contra `ACTION_LABELS`.

**Testes novos:** `tests/unit/acao-de-crm-no-motor.test.ts` (9), `lib/followup/acao-de-crm.test.ts` (7), `lib/followup/validate-publish-crm-action.test.ts` (5) e os de rótulos. Regressão: `tests/unit` com as mesmas 142 falhas de antes, nenhuma nova.

**Não provado ainda (precisa de banco/WhatsApp real):** a fronteira de atendimento (`serviceForEvent`) é amarrada ao **evento de origem**. Num fluxo com espera longa antes de enviar, ela pode estar obsoleta quando a ação rodar — nesse caso a ação falha com o motivo (não envia para conversa errada). Confirmar com um fluxo real "esperar 2 dias → enviar" é o primeiro teste da Fase 4/5.
**Ainda sem tela:** não há editor para criar um fluxo `crm_automation` (Fase 5); o nó já aparece nos resumos, no canvas e no dossiê do fluxo.

## 9. Fase 4 — migrar as regras para o motor único (plano, 21/11/2026)

### Mudança de abordagem, a decidir: "sombra" = simulação, não execução dupla
O plano original dizia "executar em paralelo (sombra) comparando resultados". **Executar as duas ao mesmo tempo mandaria cada WhatsApp, webhook e tarefa em dobro.** Troco por:
1. **Simulação (a "sombra")**: converter TODAS as regras em memória e rodar o validador de publicação, sem gravar nada, com um relatório "esta regra converte / esta não, por quê". É o ensaio.
2. **Virada reversível**: por organização, numa transação, cria o fluxo `crm_automation` ativo **e desliga a regra original** (a linha da regra fica guardada, com `migrated_to_pointer_id`). **Voltar atrás** = religar a regra e pausar o fluxo. Nunca há dois ativos para a mesma coisa.
Como ainda não há dados reais de clientes, o risco é baixo; a simulação serve para o caso de haver regra "esquisita".

### Etapas
- **4a (sem tocar em dados):** conversor puro `regraParaFluxo` (gatilho + condições → `trigger_config.event`; cada ação → um nó `crm_action` em cadeia; fim) + testes, validado pelo mesmo `flowGraphSchema` e `validateFlowForPublish` do publicar. Gatilho `event` ganha `params.config` (os parâmetros dos gatilhos por tempo: dias, direção, funil, campo, proteger pela agenda).
- **4b (relógios):** os 3 crons por tempo (`lead-time-triggers`, `lead-date-field-due`, `contact-birthdays`) hoje só leem `automation_rules`. Passam a ler **as duas fontes** (regras + fluxos `crm_automation` com gatilho `event` desse tipo), emitindo o evento "apontado" (`rule_id` = id do fluxo). O gatilho por evento passa a aceitar evento apontado quando o `rule_id` é o id do próprio fluxo (hoje ele o ignora). Trava de disparo (`regra:negócio:âncora`) continua igual.
- **4c (virada):** migration (`automation_rules.migrated_to_pointer_id`), função de migrar por organização com `dry_run` por padrão (a simulação), a virada e o desfazer. Backup/export das regras antes. **Eu não aplico em banco nenhum sem você mandar.**
- **4d:** prova ponta a ponta com banco e WhatsApp reais (fluxo "esperar 2 dias → enviar", janela de envio, silêncio por tempo).
