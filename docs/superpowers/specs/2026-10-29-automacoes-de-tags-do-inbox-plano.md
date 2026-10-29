# Automações de tags do Inbox — plano (só planejamento, nada implementado)

Pedido: marcar o lead com tags automaticamente a partir do comportamento dele no Inbox.
Exemplos do pedido: (1) "se o lead mandou X mensagens, adiciona a tag Z"; (2) botão de
WhatsApp da página de obrigado com mensagem pré-preenchida, que marca quem a enviou; (3) "não
atendido em 24h → cria a tag Z".

## O que já existe e deve ser reaproveitado (nada de motor novo)

- Motor de automações: `lib/automation/` (regras em `automation_rules`, avaliação em
  `decider.ts`, execução em `engine.ts`), com a ação **`add_tag`** (`actions/add-tag.ts`).
- Gatilhos por tempo: `lead.silent_for` (N dias sem mensagem, por direção) e
  `lead.stage_stale`, varridos pelo cron `lead-time-triggers`, com trava por **âncora** no
  `event_log` (dispara uma vez por episódio). Hoje a granularidade é de **dias**
  (`DIAS_MIN = 1`).
- Tags: categorias e cores em `lib/tags/categorias.ts`; tags automáticas já existentes
  ("Contato", "Abordagem: X…") em `lib/leads/tags-automaticas.ts`.
- Origem pela mensagem pré-preenchida: `lib/leads/origem-do-site.ts` e o casamento de
  clique/ref em `lib/plataformas-de-anuncio/*/captura-de-clique`.

## Lacunas (o que cada exemplo pede de novo)

| Exemplo | Gatilho que falta | Observação |
|---|---|---|
| "Mandou X mensagens → tag Z" | `conversation.inbound_count_reached` (N mensagens do cliente) | Contar `messages` direction=in por conversa; disparo uma vez por (regra, conversa) |
| Botão da página de obrigado | `message.matches_text` (a mensagem recebida contém/casa um texto) | A mensagem pré-preenchida carrega um código curto (ex. `#obrigado-lp12`); a regra casa o código e põe a tag. Reaproveita o casamento de `ref` já usado nos anúncios |
| "Sem atendimento em 24h" | `conversation.unanswered_for_hours` | O silêncio de hoje é em dias; precisa de granularidade em horas e de olhar `last_inbound_at` > `last_outbound_at`, respeitando a janela de atendimento do canal |

## Proposta

1. **Um gatilho por lacuna** no mesmo contrato dos existentes (config pura em
   `lib/automation/gatilhos-*.ts`, editor de regras e varredura leem a mesma fonte).
2. **Ação `add_tag` com categoria**: a tag criada nasce na categoria "Ação" (ou na escolhida na
   regra), para herdar cor e entrar no filtro do Inbox (ver Configurações do Inbox).
3. **Tela**: reaproveitar Configurações › Automações; no Inbox, atalho "Automação de tags" em
   Configurações do Inbox que abre a lista já filtrada por ação `add_tag`.
4. **Anti-morte / laço de retorno** (doutrina Sistema Vivo): toda aplicação registra atividade
   na linha do tempo do lead ("Tag Z adicionada por automação X") e a regra mostra quantas vezes
   disparou; tag que nunca é consumida por filtro, view ou follow-up vira aviso na tela de regras.
5. **Idempotência**: trava `regra:conversa:âncora` no `event_log` (como o silêncio).
6. **Segurança**: org sempre da regra (nunca do corpo); `requireSupportWrite` e papel `manager`
   para criar regras; contato pessoal/bloqueado fora (já coberto por `guarda-do-contato.ts`).

## Ordem sugerida de entrega

1. `message.matches_text` (menor, destrava a página de obrigado e já usa `add_tag`).
2. `conversation.inbound_count_reached`.
3. `conversation.unanswered_for_hours` (maior: granularidade em horas no cron e janela do canal).

## Decisões que dependem do dono do produto

- A mensagem do botão da página de obrigado: texto fixo com código visível, ou o código vai
  oculto (ex. no fim da mensagem)?
- "Não atendido" conta só horário comercial do canal ou 24h corridas?
- A tag criada fica no lead (contato) ou na conversa? Hoje o filtro do Inbox lê as duas.
