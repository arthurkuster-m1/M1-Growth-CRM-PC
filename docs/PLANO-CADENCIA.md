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

### Ajustes de 25/10/2026 (feitos)
- Funil "Prospecção ativa" começa em **Novo lead** e termina em **Perdido** (lead bom que não aderiu agora: revisitar de 3 em 3 meses) e **Desqualificado** (lead ruim: revisitar de 6 meses a 1 ano).
- O atalho do CRM dentro da campanha abre as oportunidades do funil dela.
- Tags da abordagem: nome inteiro, categoria **Funil** com cor; **"Abordagem: nome" ganha uma categoria própria por funil** (nome do funil, cor própria). "Contato" e "Contato com decisor" ficam na categoria Funil compartilhada: a categoria de uma tag é da organização inteira, pelo texto, então a mesma tag em dois funis não pode estar em duas categorias. Se for preciso separar, a tag precisa carregar o funil no nome.
- **Largada da cadência:** o lead em "Novo lead" passa sozinho para "Abordagem" (e a cadência começa) quando (a) um disparo da campanha que o inclui é iniciado — agora ou por agendamento — ou (b) a primeira ação de abordagem (ligação, mensagem, e-mail) é registrada, no Modo Prospecção ou na ficha. Essa primeira ação já conta como o passo 1. Teto de 2.000 leads por disparo; o resto avança na primeira ação sobre ele.

### Fase 6 — Cadência como página principal (etapa A)
**Descrição.** A Cadência vira a página principal da campanha de Prospecção e absorve a Abordagem.
- **Linha do tempo horizontal no topo**, no estilo do funil: D0, D+1, D+2… cada passo desenhado (meio e abordagem), com quantos leads estão em cada um. Clicar no passo abre a configuração embaixo.
- **Abordagem criada dentro do passo** e reutilizável nos outros passos (o mesmo roteiro no D0 e no D+2). Ligação segue sendo só o roteiro.
- A página "Abordagem" separada deixa de existir como aba; o conteúdo atual é migrado, sem perder o que já foi cadastrado.
- **Leads em cadência:** o número "N leads em cadência agora" vira link para as oportunidades do CRM já filtradas; no CRM, a propriedade/filtro **Cadência** mostra em que passo cada lead está (e se está atrasado).

**Aceite.** Desenhar D0, D+2 e D+5 na linha do tempo, criar a abordagem no D0 e reaproveitá-la no D+2; clicar no contador abre o CRM só com esses leads; filtrar o CRM por "passo D+2".

### Fase 7 — Fluxo visual da abordagem de WhatsApp (etapa B)
**Descrição.** Desenhar, no estilo do fluxo de follow-up, a conversa da abordagem: mensagem inicial, **aguardar a resposta**, mensagem seguinte; também áudio, análise da resposta e encaminhar ao atendente se for positiva. Só o desenho e a simulação (nada é enviado), reaproveitando o editor visual de fluxos de follow-up.

### Fase 8 — Execução real da abordagem de WhatsApp (etapa C)
**Descrição.** O fluxo de conversa desenhado na Fase 7 passa a rodar de verdade, em partes pequenas, cada uma entregável e segura sozinha. Princípio: **nada sai sem aprovação humana** no começo, e o que já existe no motor de Disparos (ritmo, janela de horário, teto diário, opt-out, canal, métricas) é **reaproveitado, não reescrito** — o disparo já congela a mensagem de cada destinatário na preparação (`rendered_body`) e o envio é do cron.

**Pontos de apoio que já existem:** `lib/campanhas/preparacao.ts` (a lista congelada, com a mensagem renderizada por destinatário), `rodada.ts` (o envio com ritmo, janela e tetos), `resposta.handler.ts` (a resposta do lead volta para o disparo, janela de 72 h), `lib/opt-out/deteccao.ts` (a única regra de "parar"), o escolhedor de número/canal da aba Disparos e o encaminhamento ao atendente já usado pelos agentes.

#### 8a — Ligar a abordagem ao disparo (sem enviar nada novo) — **concluída em 25/10/2026**
- O disparo ganha a escolha da **abordagem** (e, por ela, do fluxo de conversa); sugerida a do passo D0 da cadência da campanha.
- O **número que envia** continua sendo o escolhido na aba Disparos (oficial ou não).
- Aceite: criar um disparo, escolher a abordagem e ver o fluxo dela resumido na tela do disparo.

#### 8b — A IA escreve a mensagem de cada lead, e você aprova — **código pronto (25/10/2026)**
- Na **preparação**, cada destinatário recebe a mensagem escrita pela IA (a partir da **ideia central** e dos dados do lead), **congelada** como as demais.
- Tela de **revisão**: amostra de 3 a 5 mensagens, com abrir/editar/regerar cada uma, tirar um lead da lista e ver o **custo de IA** estimado. O **Iniciar** só libera depois de a amostra ser aprovada.
- Passos de texto fixo seguem o texto fixo; só o passo marcado "A IA escreve" usa a IA. Falha da IA num lead não derruba a lista: o lead fica marcado para revisão e não sai.
- Aceite: preparar um disparo de 10 leads, ver 10 mensagens diferentes e coerentes com a ideia central, editar uma, aprovar, e nada ser enviado ainda.

#### 8c — Enviar a primeira mensagem pelo canal escolhido — **código pronto (25/10/2026)**
- O envio usa o motor de disparos como está (ritmo, janela, teto, opt-out). **Aprovação por disparo**, com limite pequeno no começo (por exemplo 20 leads por disparo) para provar com poucos antes de abrir.
- **Canal não oficial (WAHA):** mensagem livre. **Canal oficial:** fora da janela de 24 h só vai **modelo aprovado**; a IA escreve só depois que o lead responde. A tela diz isso antes de iniciar.
- O lead enviado conta como a primeira abordagem (já move "Novo lead" → "Abordagem" e dá o passo 1 da cadência).
- Aceite: um disparo de 3 leads de teste sai pelo número escolhido, com a mensagem aprovada, respeitando a janela; o histórico e a cadência refletem.

#### 8d — O fluxo continua quando o lead responde — **código pronto (25/10/2026)**
- A resposta do lead (já atribuída ao disparo) **destrava o passo seguinte do fluxo**: nova mensagem (fixa ou da IA), áudio, ou **encaminhar ao atendente** (o mesmo encaminhamento que os agentes usam).
- A resposta **encerra a cadência** e sobe o lead de etapa (já existe); pedido de parar (opt-out) interrompe o fluxo na hora.
- Política de aprovação da continuação: começa em **"aprovar cada mensagem"** (a IA propõe, a pessoa libera), com o automático como opção por abordagem, só depois de provado.
- Prazo do "aguardar": sem resposta no prazo, o lead segue a cadência normalmente.
- Aceite: um lead de teste responde, o passo seguinte é proposto, aprovado e enviado; "pare" interrompe; "encaminhar" cai no atendente.
- **Como ficou:** migration 0666 (`campaign_recipients.flow_*` e `proposal_*`). Depois da abertura, o destinatário fica "esperando a resposta" (com o prazo do passo "aguardar"). Ao responder: a cadência termina, o lead sobe de etapa e ganha a tag "Contato · Funil"; o passo seguinte vira **proposta** (texto fixo com o nome, ou escrita pela IA com a abertura e as respostas do lead) no painel "Continuação da conversa" do disparo, onde a pessoa **aprova e envia (podendo editar)**, pede outra à IA, pula ou encerra. "Encaminhar" cria a tarefa do dono do lead. Contato bloqueado encerra o fluxo; sem resposta no prazo, o fluxo termina (varredor de 15 min). **Fica para a 8e:** enviar o áudio (hoje a proposta de áudio só pode ser pulada/"Já mandei").

#### 8e — Áudio gravado e reutilizável — **código pronto (25/10/2026)**
- Anexar o **arquivo de voz gravado por você** à abordagem (um arquivo por abordagem, no armazenamento de mídia privado), e enviá-lo como mídia nos passos de áudio — a mesma regra do repositório: subir primeiro, passar a URL assinada ao provedor.
- Aceite: o áudio gravado sai num passo de áudio e o mesmo arquivo serve em outra abordagem.
- **Como ficou:** migration 0667 (`approach_audios` + `demand_approach_steps.audio_id`). A biblioteca de áudios é da empresa: no passo de áudio do fluxo a pessoa **envia o arquivo de voz** (ogg, mp3, m4a, wav, aac ou amr, até 8 MB, farejado pelos bytes) ou escolhe um já guardado, e o mesmo arquivo serve em qualquer abordagem. O arquivo fica no bucket privado `whatsapp-media` (pasta `<org>/audios-da-abordagem/`); ao aprovar a proposta de áudio no painel "Continuação da conversa", ele é copiado para a pasta da conversa e enviado como mídia (o canal baixa por URL assinada curta). Na API oficial wav e webm são recusados antes do envio (a Meta não os aceita); a lista de áudios avisa. Passo sem arquivo avisa no desenho e não envia (resta "Já mandei à mão"). **Fica para depois:** gravar direto no navegador e ouvir o áudio na tela.

**Riscos e como cada um é tratado:** banimento do número (ritmo, janela, tetos e aprovação manual já existentes; começar com poucos leads); custo de IA (estimativa antes de aprovar, teto por disparo); mensagem ruim da IA (amostra, edição e aprovação; nada sai sem revisão); canal oficial com regra própria (a tela explica e bloqueia o que não pode); pedido de parar (regra única do repositório, interrompe o fluxo); LGPD (as mesmas exclusões e base legal do disparo).

**Perguntas que ainda decidem o desenho (responder antes de 8b/8d):**
1. A aprovação da 8b é **por amostra** (3 a 5, com a lista aprovada de uma vez) ou **lead a lead**? Proposta: por amostra, com a opção de abrir cada uma.
2. A continuação da 8d começa **sempre aprovada à mão**? Proposta: sim, e liberar o automático por abordagem depois.
3. Teto de leads por disparo no começo (proposta: 20) e o modelo de IA a usar (proposta: o mesmo do gateway já configurado, escolhido nas configurações).

**Decisões tomadas (25/10/2026):**
1. A aba "Abordagem" some para a Prospecção; as abordagens já cadastradas foram para dentro da Cadência. **Feito na Fase 6.**
2. Começar com **aprovação manual de cada disparo**. O **agente de IA escreve a mensagem de cada lead, personalizada, a partir da ideia central da abordagem**. O número que envia é escolhido **na aba de Disparos**, API oficial ou não oficial.
3. "Resposta positiva" era só um exemplo: fica de fora por enquanto.
4. Áudio: **arquivo de voz gravado por você e reutilizado** (um arquivo por abordagem).

**Para a Fase 7/8 (já decidido):** a abordagem de WhatsApp passa a ter a "ideia central" (o que o agente usa para personalizar) e passos do fluxo (mensagem, aguardar resposta, mensagem seguinte, áudio gravado). O canal e o número vêm do disparo, então o fluxo da abordagem não escolhe número.

## 7. Pontos em aberto

- Mensagem enviada AUTOMATICAMENTE ao cliente depois da falta ("sentimos sua falta"): exige envio pelo canal (janela de 24h, modelos aprovados, anti-banimento) e fica fora da Fase 5.
- Se o destino de fim de cadência pode ser "Nutrição" (precisa existir uma etapa/funil de nutrição).
- Se a cadência também deve existir em campanhas que não são de Prospecção (por ora, só Prospecção).
- ~~Limite de leads por dia na lista "Hoje"~~ — resolvido na Fase 4: a meta de leads da sessão de prospecção limita a lista "Cadência de hoje".
- Continuação automática (sem aprovação) por abordagem: só depois de provar a aprovada à mão.
- Gravar o áudio direto no navegador e ouvi-lo na tela (hoje só se envia o arquivo).
- Ramificações do fluxo (resposta positiva/negativa); hoje o fluxo é linear.
- Guardar o custo da IA da continuação (a abertura já guarda por lead).

## 8. Registro de execução

| Fase | Situação | Observação |
|---|---|---|
| 1 — Funil, tags e no-show | Concluída (24/10/2026) | "Reunião realizada" e "Desqualificado" mantidas no modelo (exigência do sistema); funis existentes não mudam. |
| 2 — Cadência | Concluída (24/10/2026, PR #81) | Migration 0659. Entregue: página Cadência (passos, destino do fim, modelos), inscrição por gatilho ao entrar em Abordagem, avanço/encerramento ao registrar abordagem, cron `cadence-sweep` (15 min) e botão "Inscrever quem já está em Abordagem". A etapa do lead não subia sozinha ao responder (resolvido na Fase 5); depois do último passo o lead tem 2 dias para responder. |
| 3 — "Hoje" | Concluída (24/10/2026, PR #82) | Sem migration: o passo de hoje é CALCULADO da inscrição (não grava "próxima ação" no lead, para não duplicar a fonte). Botão "Cadência de hoje" nas oportunidades do CRM + faixa do passo no Modo Prospecção. A lista de hoje só se atualiza ao sair do Modo, para a fila não mudar sob os pés. Limite diário da lista segue em aberto. |
| 4 — Anti no-show | Concluída (24/10/2026, PR #83) | Migration 0660. Aba "Anti no-show" em Configuração da Agenda: fluxos por tipo de compromisso (um fluxo por tipo). Cada fluxo: horas antes para virar tarefa de ligar sem confirmação; tag de confirmou; tag de faltou (com contador); dias úteis para a oportunidade voltar à fila ("Remarcar"). O aviso ao cliente segue sendo o lembrete do tipo (não duplicado). Aplicado nos 3 pontos: confirmação pela equipe, resposta do cliente e registro de falta. Mini-cadência de remarcação e mensagens próprias do fluxo: Fase 5. A meta de leads da sessão de prospecção passou a limitar também a lista "Cadência de hoje". |
| 5 — Pontas soltas | Concluída (24/10/2026, PR #84) | Migration 0661. Etapa ao responder (Contato / Contato com decisor, só para a frente). Fim por tempo verificado no banco de desenvolvimento: o gatilho inscreveu, cancelou ao sair da etapa, reinscreveu ao voltar e deixou a inscrição vencida visível para a varredura (dados criados e desfeitos); a rota do cron em si só foi exercitada pelos testes. Mini-cadência de remarcação (até 6 tentativas, intervalo em dias úteis; termina ao responder, remarcar ou esgotar). Mensagens dos lembretes editáveis na aba Anti no-show (mesma fonte do tipo). Fora: mensagem enviada automaticamente depois da falta. |
| Ajustes de 25/10 | Concluídos (PR #86 e este) | Novo lead, atalho do CRM, tags por funil, largada da cadência. |
| 6 — Cadência principal | Concluída (25/10/2026) | Migration 0662 (dados: troca `abordagem` por `cadencia` nas páginas escolhidas de Prospecção). A Cadência é a página onde a campanha de Prospecção abre; linha do tempo horizontal (D0, D+2…, com leads por passo e o nó "Fim"); painel do passo; abordagem criada no passo e reaproveitável; as abordagens já cadastradas aparecem dentro da Cadência ("Abordagens da campanha", com onde cada uma é usada) e a aba "Abordagem" não existe mais para a Prospecção (os dados são os mesmos). CRM: o contador vira link para as oportunidades em cadência (`?cadencia=ativa`), coluna "Cadência" e filtro por passo. Tags de contato por funil ("Contato · Funil", "Contato com decisor · Funil") na categoria de tags do funil. |
| 7 — Fluxo visual de WhatsApp | Concluída (25/10/2026, PR #89) | Migration 0663. Dentro da Cadência, cada abordagem de WhatsApp tem o **Fluxo de conversa**: cartões ligados por setas (mensagem, áudio gravado, aguardar a resposta com prazo, encaminhar ao atendente), a **ideia central** que a IA usa para personalizar a mensagem de cada lead e uma **simulação** (o lead "responde" e a conversa segue; nada é enviado). Avisos do que falta no desenho. Fluxo linear, um caminho só; ramificações (resposta positiva/negativa) ficam para a execução. O áudio guarda só o nome: o arquivo gravado é anexado na Fase 8. |
| 8 — Execução real | Código concluído (25/10/2026, PRs #90 a #96); **aguardando teste na tela** | Cinco partes, todas na `main`. **8a** (migration 0664): o disparo escolhe a abordagem de WhatsApp da campanha (sugerida a do passo mais cedo da cadência) e mostra o fluxo e a ideia central. **8b** (migration 0665): a IA do agente principal escreve a abertura de cada lead (até 20 por disparo); a pessoa revisa por amostra, edita, pede outra, tira lead da lista e aprova; sem aprovação o disparo não inicia nem agenda; mudar texto, público ou abordagem derruba a aprovação; custo guardado por lead. **8c** (sem migration): o envio usa o motor de disparos como está (ritmo, janela, teto, opt-out); número da API oficial recusa a abertura livre da IA; cada mensagem enviada entra na linha do tempo do lead, dá o passo da cadência e põe a tag "Abordagem: nome". **8d** (migration 0666): depois da abertura o lead fica esperando a resposta; ao responder, a cadência termina, o lead sobe de etapa e ganha "Contato · Funil"; o passo seguinte vira proposta no painel "Continuação da conversa" (aprovar e enviar, editar, pedir outra à IA, pular, encerrar); "encaminhar" cria tarefa para o dono do lead; pedido de parar e prazo vencido encerram o fluxo. **8e** (migration 0667): biblioteca de áudios da empresa, reutilizável em qualquer abordagem; o áudio sai como mídia ao aprovar; wav e webm são recusados na API oficial. Decisões de 25/10: aprovação por amostra; continuação aprovada à mão; 20 leads por disparo; modelo de IA do gateway configurado. **Nunca provado fora de testes automáticos:** envio real (WAHA e Meta), IA com provedor real, tela. Roteiro em `docs/ROTEIRO-DE-TESTES-CADENCIA.md`. |
