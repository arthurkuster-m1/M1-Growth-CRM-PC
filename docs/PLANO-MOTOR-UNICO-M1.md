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
