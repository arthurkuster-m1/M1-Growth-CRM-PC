# Plano — Cadência da Prospecção Ativa (e anti no-show)

> Criado em 24/10/2026, a partir da conversa com o Arthur. Este arquivo é a fonte do plano: cada fase
> abaixo tem descrição, entregas e critério de aceite, e o "Registro de execução" no fim diz em que
> pé está cada uma. Atualize-o quando uma fase entrar na `main`.

## 1. Objetivo

Em campanha de **Prospecção Ativa** abordamos o mesmo lead várias vezes, por meios e abordagens
diferentes, até ele responder. Hoje cada abordagem é registrada à mão, mas **não há um desenho do
processo** (o que fazer em cada dia), nem um lembrete do que trabalhar hoje, nem a medida de
no-show. Este plano entrega:

1. O funil de prospecção do jeito que o Arthur trabalha, com **tags automáticas** (contato, contato
   com decisor, abordagem usada) e **no-show** medido no dashboard.
2. Uma **cadência** desenhável por campanha (e em modelos reaproveitáveis), como subpágina da
   campanha, a exemplo da página do funil.
3. Uma lista **"Hoje"** (o lembrete diário do que abordar) no Modo Prospecção.
4. **Fluxos anti no-show** construídos na Agenda, ligados a tipos de compromisso, que refletem na
   oportunidade do lead.

## 2. Decisões já tomadas (24/10/2026)

| # | Decisão |
|---|---|
| 1 | Ordem das etapas de venda: **negociação antes da venda**. |
| 2 | **Fim da cadência sem resposta:** o destino (Perdido, Nutrição…) é escolhido **no último passo do desenho**, campanha a campanha. |
| 3 | A cadência vale **só para leads na etapa "Abordagem"** (a fase de tentativa de contato). **Toda vez que um lead novo entra em "Abordagem", a cadência dele começa.** Não há migração automática de leads antigos; quem já está em "Abordagem" só entra se a pessoa o inscrever. |
| 4 | **Cada campanha desenha a sua cadência**, mas também existem **modelos reaproveitáveis** (da organização) que se copiam para a campanha. |
| 5 | O **anti no-show é construído na Agenda** (aba própria), com um fluxo por **tipo de compromisso**; ele reflete na **oportunidade do lead** que tem o compromisso. Não é exclusivo da prospecção. |

## 3. Conceitos (para todo mundo falar a mesma língua)

- **Abordagem:** o roteiro/gancho/mensagem (já existe, página "Abordagem" da campanha).
- **Passo da cadência:** "no dia D+N, por tal meio, com tal abordagem".
- **Cadência:** a lista ordenada de passos de uma campanha (ou de um modelo).
- **Inscrição:** o estado de UM lead numa cadência (passo atual, próxima data, situação).
- **Funil:** onde o lead está pelo **resultado** (abordagem, contato, decisor, reunião…). A cadência
  é o **processo no tempo** que roda dentro da etapa "Abordagem". São coisas separadas e ligadas.

## 4. Desenho (resumo das escolhas)

- **Cadência fora do funil.** Um passo por etapa transformaria o funil em fila e estragaria os
  números. O funil tem **uma** etapa de entrada ("Abordagem"); a cadência trabalha dentro dela.
- **Saída automática:** o lead responde (registro de contato) → a inscrição vira "respondeu", a
  cadência para e o lead sobe de etapa. Último passo sem resposta → o destino do desenho.
- **Tags são rótulo; o histórico é a conta.** O sistema grava a tag (para filtrar no CRM) **e** o
  histórico datado (que não se apaga). Contagens por dia e taxas vêm do histórico, nunca da tag
  atual — quem remove uma tag não pode mudar o passado.
- **Tags automáticas** (nas pessoas do CRM, onde as tags já moram): "Contato", "Contato com
  decisor" (uma vez, sem contador) e "Abordagem: X" (com contador "Abordagem: X: 3x", que mostra
  quantas vezes foi usada naquele lead).
- **Anti no-show na Agenda**, por tipo de compromisso, usando o lembrete e a confirmação que a
  Agenda já tem; o resultado (confirmou, faltou) reflete na etapa e nas tags da oportunidade.

## 5. Funil de prospecção (modelo fixo "Prospecção ativa")

Abordagem › Contato › Contato com decisor (MQL) › Reunião agendada › Reunião realizada ›
Em negociação › **Venda realizada** (ganho) · **Perdido** (perda) · Desqualificado.

Mantidas, mesmo fora da lista do Arthur, por exigência do sistema: **"Reunião realizada"** (a
Agenda move o lead para ela quando o compromisso é concluído, e a janela pós-reunião depende dela)
e **"Desqualificado"** (a regra de funil exige uma etapa de desqualificação). Funis já criados
**não mudam**: o modelo só vale para funis novos.

## 6. Fases

### Fase 1 — Funil, tags automáticas e no-show no dashboard
**Descrição.** Base de medição, sem a cadência ainda.
- Modelo fixo "Prospecção ativa" com as etapas do item 5.
- Registro de abordagem (ficha e Modo Prospecção) passa a gravar, na mesma ação: tag "Contato" se
  houve contato, "Contato com decisor" se falou com o decisor, e "Abordagem: X" (com contador) se
  uma abordagem foi escolhida. O histórico guarda quais tags automáticas foram postas.
- Dashboard de Prospecção Ativa: colunas **No-Show** e **Taxa de No-Show** (faltaram ÷ agendadas).
- Sem migration.

**Aceite.** Registrar "Atendeu — falou com o decisor" com uma abordagem põe as três tags no contato
e uma única linha no histórico; registrar de novo soma o contador da abordagem e não repete
"Contato". Um compromisso marcado como falta aparece como No-Show no dashboard.

### Fase 2 — Cadência (desenho, modelos e inscrição)
**Descrição.** A subpágina "Cadência" da campanha de Prospecção (página opcional, como Abordagem).
- Linha do tempo vertical, reordenável: cada passo = dia (D0, D+2…), meio, abordagem, observação.
- **Último passo:** destino do lead sem resposta (por campanha).
- **Modelos da organização:** salvar a cadência como modelo e copiar um modelo para a campanha.
- **Inscrição automática:** lead que entra na etapa "Abordagem" inicia a cadência da campanha;
  parar ao registrar contato; esgotar ao fim do último passo aplicando o destino.
- Migration: cadências (campanha ou modelo), passos e inscrições, com RLS e apêndice no baseline.

**Aceite.** Desenhar três passos, mover um lead novo para "Abordagem" e ver a inscrição com o
passo 1 e a data; registrar contato encerra a inscrição; deixar o prazo vencer leva o lead ao
destino configurado.

### Fase 3 — "Hoje" (o lembrete diário)
**Descrição.** No Modo Prospecção, a fila do dia: os leads cujo passo vence hoje (e os atrasados),
com a abordagem sugerida e o roteiro ao lado. Registrar a abordagem marca o passo como feito e
agenda o seguinte (usa a "próxima ação" que já existe). Contagem do dia no topo.

**Aceite.** Com 10 leads com passo para hoje, a fila mostra os 10; registrar um avança o passo e o
tira da fila; atrasados aparecem separados.

### Fase 4 — Anti no-show na Agenda
**Descrição.** Aba na Agenda para **construir fluxos anti no-show** e dizer **a quais tipos de
compromisso** cada fluxo se aplica. Modelo inicial: confirmação um dia antes → lembrete duas horas
antes → se não confirmou, tarefa para ligar → se faltou, tag "No Show" e mini-cadência de
remarcação. O fluxo reflete na oportunidade do lead que tem o compromisso (etapa, tags e histórico).
Reaproveita o lembrete e a confirmação da Agenda.

**Aceite.** Um compromisso de um tipo com fluxo vinculado recebe a confirmação e o lembrete nos
horários; confirmar marca "confirmou"; faltar marca a oportunidade e inicia a remarcação.

### Fase 5 — Pontas soltas das fases 1 a 4
**Descrição.** Fecha o que as quatro primeiras fases deixaram de fora.
- **Etapa ao responder:** o lead que tem cadência ativa e registra contato sobe sozinho de etapa — "Contato" (atendeu) ou "Contato com decisor" (falou com o decisor) —, só para a frente e só se o funil tiver a etapa.
- **Fim por tempo, provado no banco:** o gatilho de inscrição e a varredura de encerramento são exercitados de verdade no banco de desenvolvimento (dados criados e desfeitos), não só nos testes.
- **Mini-cadência de remarcação:** o fluxo anti no-show passa a ter N tentativas de remarcar, com intervalo em dias úteis; cada abordagem registrada sem sucesso agenda a próxima, e o ciclo para quando o cliente responde, quando ele já tem novo compromisso ou quando as tentativas acabam.
- **Mensagens do fluxo:** a aba Anti no-show mostra e edita a mensagem de cada lembrete dos tipos do fluxo (a mesma fonte do tipo de atendimento, sem cópia).
- Migration: colunas de tentativas no fluxo e tabela das remarcações em andamento.

**Aceite.** Registrar "falou com o decisor" num lead com cadência ativa o leva a "Contato com decisor". Marcar uma falta num tipo com 3 tentativas põe o lead na fila; registrar "sem resposta" agenda a seguinte; na terceira, a remarcação termina. Editar a mensagem de um lembrete na aba Anti no-show muda o lembrete do tipo.

## 7. Pontos em aberto

- Mensagem enviada AUTOMATICAMENTE ao cliente depois da falta ("sentimos sua falta"): exige envio pelo canal (janela de 24h, modelos aprovados, anti-banimento) e fica fora da Fase 5.
- Se o destino de fim de cadência pode ser "Nutrição" (precisa existir uma etapa/funil de nutrição).
- Se a cadência também deve existir em campanhas que não são de Prospecção (por ora, só Prospecção).
- Limite de leads por dia na lista "Hoje" (para não virar fila impossível de zerar).

## 8. Registro de execução

| Fase | Situação | Observação |
|---|---|---|
| 1 — Funil, tags e no-show | Concluída (24/10/2026) | "Reunião realizada" e "Desqualificado" mantidas no modelo (exigência do sistema); funis existentes não mudam. |
| 2 — Cadência | Concluída (24/10/2026, PR #81) | Migration 0659. Entregue: página Cadência (passos, destino do fim, modelos), inscrição por gatilho ao entrar em Abordagem, avanço/encerramento ao registrar abordagem, cron `cadence-sweep` (15 min) e botão "Inscrever quem já está em Abordagem". A etapa do lead não subia sozinha ao responder (resolvido na Fase 5); depois do último passo o lead tem 2 dias para responder. |
| 3 — "Hoje" | Concluída (24/10/2026, PR #82) | Sem migration: o passo de hoje é CALCULADO da inscrição (não grava "próxima ação" no lead, para não duplicar a fonte). Botão "Cadência de hoje" nas oportunidades do CRM + faixa do passo no Modo Prospecção. A lista de hoje só se atualiza ao sair do Modo, para a fila não mudar sob os pés. Limite diário da lista segue em aberto. |
| 4 — Anti no-show | Concluída (24/10/2026, PR #83) | Migration 0660. Aba "Anti no-show" em Configuração da Agenda: fluxos por tipo de compromisso (um fluxo por tipo). Cada fluxo: horas antes para virar tarefa de ligar sem confirmação; tag de confirmou; tag de faltou (com contador); dias úteis para a oportunidade voltar à fila ("Remarcar"). O aviso ao cliente segue sendo o lembrete do tipo (não duplicado). Aplicado nos 3 pontos: confirmação pela equipe, resposta do cliente e registro de falta. Mini-cadência de remarcação e mensagens próprias do fluxo: Fase 5. A meta de leads da sessão de prospecção passou a limitar também a lista "Cadência de hoje". |
| 5 — Pontas soltas | Concluída (24/10/2026, PR #84) | Migration 0661. Etapa ao responder (Contato / Contato com decisor, só para a frente). Fim por tempo verificado no banco de desenvolvimento: o gatilho inscreveu, cancelou ao sair da etapa, reinscreveu ao voltar e deixou a inscrição vencida visível para a varredura (dados criados e desfeitos); a rota do cron em si só foi exercitada pelos testes. Mini-cadência de remarcação (até 6 tentativas, intervalo em dias úteis; termina ao responder, remarcar ou esgotar). Mensagens dos lembretes editáveis na aba Anti no-show (mesma fonte do tipo). Fora: mensagem enviada automaticamente depois da falta. |
