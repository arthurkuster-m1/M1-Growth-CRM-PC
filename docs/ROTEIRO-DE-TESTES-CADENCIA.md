# Roteiro de testes — Cadência, anti no-show e execução da abordagem

Para testar **pela tela**, como um usuário de verdade. Cobre as Fases 1 a 8 (24 e 25/10/2026) do
[`PLANO-CADENCIA.md`](PLANO-CADENCIA.md). Nada disto foi provado na tela até agora: os testes
automáticos passaram, mas **nenhum envio real (WhatsApp) e nenhuma IA com provedor real foi
exercitado**. O que você encontrar aqui é o que mais interessa.

Marque cada item: **OK**, **FALHOU** (anote o que viu) ou **N/A**.

---

## 0. Antes de começar

**Segurança — leia antes de qualquer envio**

- Use **só números seus** como leads de teste (2 ou 3 contatos: o seu celular, o de um colega que
  sabe do teste). Nunca clientes reais.
- Teste o envio primeiro num **número não oficial (WAHA)**. Só depois, se quiser, no oficial.
- Mantenha o disparo pequeno (2 a 3 leads). O limite com mensagem da IA é 20 por disparo.

**Preparação**

1. As migrations **0659 a 0667** estão aplicadas no banco (as de desenvolvimento já estão). Num
   clone que já estava instalado, é o `update.sh` que aplica.
2. Existe um **agente de IA publicado** com modelo e chave configurados (a IA usa o mesmo cérebro
   do agente principal). Sem isso, "Gerar mensagens" avisa que a IA não está no ar.
3. Existe um **número de WhatsApp conectado** (Conexões) e, se for testar o oficial, um número da
   API oficial conectado.
4. Há um funil **Prospecção ativa** (Novo lead › Abordagem › Contato › Contato com decisor ›
   Reunião agendada › Reunião realizada › Em negociação › Venda realizada › Perdido ›
   Desqualificado) e uma **campanha de Prospecção** com 2 ou 3 leads de teste (seus números) em
   "Novo lead".

**Onde ficam as coisas**

| O quê                                    | Caminho                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| Cadência, Extração, Disparos da campanha | Marketing › Campanhas › (abrir a campanha de Prospecção)  |
| Disparos (envio)                         | Marketing › Campanhas › aba Disparos, ou `/app/campaigns` |
| Oportunidades (CRM)                      | CRM › Oportunidades                                       |
| Anti no-show                             | Configurações › Agenda › aba Anti no-show                 |
| Tarefas                                  | Tarefas                                                   |

---

## 1. Funil e tags (Fase 1 e ajustes)

| #   | Passo                                                          | Esperado                                                                                                                                                                                        | Resultado |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1.1 | Abra o funil Prospecção ativa nas Oportunidades                | Colunas na ordem: Novo lead, Abordagem, Contato, Contato com decisor, Reunião agendada, Reunião realizada, Em negociação, Venda realizada, Perdido, Desqualificado (as duas últimas por último) |           |
| 1.2 | No Modo Prospecção, registre uma ação com resultado de contato | Tag **"Contato · Prospecção ativa"** (com o nome do funil), na categoria de tags do funil, com cor                                                                                              |           |
| 1.3 | Registre ação com resultado "falou com o decisor"              | Tag **"Contato com decisor · Funil"**                                                                                                                                                           |           |
| 1.4 | Registre a mesma ação duas vezes                               | Tag de contato **não duplica**                                                                                                                                                                  |           |
| 1.5 | Registre ação com uma abordagem escolhida                      | Tag **"Abordagem: nome"** com contador (2x, 3x…)                                                                                                                                                |           |
| 1.6 | Dashboard de Prospecção                                        | Mostra no-show e os números do CRM                                                                                                                                                              |           |

## 2. Cadência (Fases 2, 3 e 6)

| #    | Passo                                                      | Esperado                                                                                                             | Resultado |
| ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| 2.1  | Abra a campanha de Prospecção                              | A **Cadência** é a primeira página e a que abre                                                                      |           |
| 2.2  | Veja a linha do tempo                                      | Horizontal, estilo funil: D0, D+2…, nó "Fim", com **leads por passo**                                                |           |
| 2.3  | Clique em um passo                                         | Painel do passo (dia, o que fazer, abordagens)                                                                       |           |
| 2.4  | Adicione um passo, mude o dia, remova um passo             | Salva e a linha do tempo se reorganiza                                                                               |           |
| 2.5  | Escolha o destino do fim (Perdido, ou uma etapa)           | Salva                                                                                                                |           |
| 2.6  | Aplique um **modelo** de cadência                          | Passos do modelo entram                                                                                              |           |
| 2.7  | Mova um lead de "Novo lead" para **Abordagem**             | Ele é **inscrito** na cadência sozinho                                                                               |           |
| 2.8  | Tire o lead de Abordagem                                   | A inscrição é **cancelada**                                                                                          |           |
| 2.9  | Clique em "Inscrever quem já está em Abordagem"            | Inscreve quem estava lá antes                                                                                        |           |
| 2.10 | Nas Oportunidades, clique em **Cadência de hoje**          | Lista só quem tem passo para hoje, do mais atrasado ao menos                                                         |           |
| 2.11 | No Modo Prospecção, veja a faixa do passo                  | Mostra o passo de hoje do lead                                                                                       |           |
| 2.12 | Configure a meta de leads da sessão (config da prospecção) | A lista "Cadência de hoje" respeita a meta (0 = lista toda)                                                          |           |
| 2.13 | Registre a abordagem de um lead que **respondeu**          | Cadência dele termina; ele **sobe** para Contato (ou Contato com decisor) e nunca volta para trás                    |           |
| 2.14 | Registre uma tentativa **sem resposta**                    | O passo é dado como feito e o próximo vence no dia certo                                                             |           |
| 2.15 | Contador de leads em cadência (CRM)                        | É link: abre as oportunidades com `?cadencia=ativa`; há coluna **Cadência** e filtro por passo                       |           |
| 2.16 | Fim por tempo: lead sem resposta depois do último passo    | Após o prazo (+2 dias), a varredura (a cada 15 min) move para o destino escolhido, **se ainda estiver em Abordagem** |           |

## 3. Anti no-show (Fases 4 e 5)

Em Configurações › Agenda › aba **Anti no-show**.

| #   | Passo                                                 | Esperado                                                                                                           | Resultado |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| 3.1 | Crie um fluxo para um tipo de compromisso             | Campos: horas antes para virar tarefa de ligar, tag de "confirmou", tag de "faltou", dias úteis para voltar à fila |           |
| 3.2 | Tente criar dois fluxos para o mesmo tipo             | Só um fluxo por tipo                                                                                               |           |
| 3.3 | Agende um compromisso e **não confirme** até a janela | Vira **tarefa de ligar** para confirmar                                                                            |           |
| 3.4 | Confirme pela equipe / o cliente responde confirmando | Entra a tag de "confirmou"                                                                                         |           |
| 3.5 | Registre **falta**                                    | Entra a tag de "faltou" (com contador) e o lead entra na **mini-cadência de remarcação**                           |           |
| 3.6 | Acompanhe a remarcação                                | Até 6 tentativas, em dias úteis; termina ao responder, remarcar ou esgotar                                         |           |
| 3.7 | Edite as mensagens dos lembretes                      | A mesma mensagem do tipo de compromisso muda (não há cópia)                                                        |           |
| 3.8 | Dashboard                                             | No-show aparece                                                                                                    |           |

> Não existe envio **automático** de "sentimos sua falta" depois da falta (ficou fora de propósito).

---

## 4. Abordagens e fluxo de conversa (Fases 6 e 7)

| #   | Passo                                                                                                                                                                            | Esperado                                                               | Resultado |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------- |
| 4.1 | Na Cadência, veja "Abordagens da campanha"                                                                                                                                       | Lista com onde cada uma é usada                                        |           |
| 4.2 | Crie uma abordagem **dentro de um passo** e reutilize em outro                                                                                                                   | Aparece nos dois                                                       |           |
| 4.3 | Confirme que **não existe** mais a aba "Abordagem" na Prospecção                                                                                                                 | Só Cadência, Extração, Disparos                                        |           |
| 4.4 | Abra o **Fluxo de conversa do WhatsApp** de uma abordagem                                                                                                                        | Cartões ligados por setas                                              |           |
| 4.5 | Monte: **Mensagem** (IA personaliza) › **Aguardar resposta** (48 h) › **Mensagem** (texto fixo com `{{primeiro_nome}}`) › **Áudio** › **Aguardar** › **Encaminhar ao atendente** | Salva; reordenar e remover funcionam                                   |           |
| 4.6 | Escreva a **ideia central**                                                                                                                                                      | Salva ao sair do campo                                                 |           |
| 4.7 | Deixe um passo de mensagem vazio ou um áudio sem arquivo                                                                                                                         | **Avisos** do que falta (nunca bloqueiam)                              |           |
| 4.8 | Use a **simulação**                                                                                                                                                              | O lead "responde" e a conversa segue passo a passo; **nada é enviado** |           |

## 5. Áudio gravado (Fase 8e)

| #    | Passo                                                                                                  | Esperado                                                                                                             | Resultado |
| ---- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------- |
| 5.1  | No passo de áudio, clique em **Enviar arquivo de voz** com um áudio seu (ogg, mp3, m4a, aac, amr, wav) | "Áudio guardado na biblioteca" e ele já fica escolhido                                                               |           |
| 5.2  | Tente enviar um PDF ou imagem renomeado para `.mp3`                                                    | **Recusado** (o tipo é lido pelos bytes)                                                                             |           |
| 5.3  | Tente um áudio acima de 8 MB                                                                           | Recusado                                                                                                             |           |
| 5.4  | Em **outra abordagem**, escolha o mesmo áudio na lista                                                 | Aparece sem enviar de novo                                                                                           |           |
| 5.5  | Envie um **wav** (ou um ogg que não seja Opus)                                                         | Na lista aparece **"(não serve na API oficial)"**                                                                    |           |
| 5.6  | Salve o fluxo e reabra                                                                                 | O áudio escolhido continua lá                                                                                        |           |
| 5.7  | Clique em **Ouvir** no áudio escolhido                                                                 | O áudio toca na própria tela                                                                                         |           |
| 5.8  | Clique em **Gravar agora**, permita o microfone, fale 5 s e **Parar e guardar**                        | A gravação entra na biblioteca (com o nome que você deu ou "Gravação data hora") e já fica escolhida; **Ouvir** toca |           |
| 5.9  | **Descartar** no meio de uma gravação                                                                  | Nada é guardado e o microfone desliga                                                                                |           |
| 5.10 | Negue a permissão do microfone                                                                         | Aviso claro, sem quebrar a tela                                                                                      |           |
| 5.11 | Grave no **Chrome** e olhe a lista                                                                     | A gravação **não** aparece como "não serve na API oficial" (foi convertida para ogg/Opus)                            |           |

---

## 6. Disparo com a abordagem (Fase 8a)

| #   | Passo                                          | Esperado                                       | Resultado |
| --- | ---------------------------------------------- | ---------------------------------------------- | --------- |
| 6.1 | Crie um disparo (aba Disparos) para a campanha | Aparece a escolha da **abordagem**             |           |
| 6.2 | Veja a sugestão                                | Vem a abordagem do passo mais cedo da cadência |           |
| 6.3 | Escolha uma                                    | Mostra o resumo do fluxo e a ideia central     |           |
| 6.4 | Escolha o **número** que envia                 | O número é escolhido aqui (oficial ou não)     |           |
| 6.5 | Crie, edite e abra o disparo                   | A abordagem escolhida permanece                |           |

## 7. Mensagens da IA e aprovação (Fase 8b)

Use uma abordagem cuja **primeira mensagem** é "IA personaliza", com ideia central preenchida,
e um número **não oficial**.

| #    | Passo                                            | Esperado                                                                                                         | Resultado |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------- |
| 7.1  | Prepare o disparo (2 ou 3 leads)                 | Aparece "Mensagens da IA" para revisar                                                                           |           |
| 7.2  | Clique para gerar                                | A IA escreve uma mensagem **por lead**, com o nome e usando só os dados do lead; curta, sem inventar fatos       |           |
| 7.3  | Veja o **custo**                                 | Mostrado por disparo                                                                                             |           |
| 7.4  | Edite o texto de um lead                         | Fica "Editada por você"; **a aprovação cai**                                                                     |           |
| 7.5  | Peça outra mensagem para um lead                 | Reescreve só aquele                                                                                              |           |
| 7.6  | Tire um lead da lista                            | Ele não recebe                                                                                                   |           |
| 7.7  | Tente **Iniciar sem aprovar**                    | **Recusado**: "Gere e aprove as mensagens"                                                                       |           |
| 7.8  | Tente **Agendar sem aprovar**                    | Recusado                                                                                                         |           |
| 7.9  | Aprove                                           | Libera Iniciar e Agendar                                                                                         |           |
| 7.10 | Mude o público, a abordagem ou prepare de novo   | A aprovação **cai**                                                                                              |           |
| 7.11 | Disparo com **mais de 20 leads** com IA          | Recusado, dizendo o teto (20)                                                                                    |           |
| 7.12 | Sem agente publicado / sem chave                 | Mensagem clara de que a IA não está no ar (sem erro genérico)                                                    |           |
| 7.13 | Num **número oficial**, abertura escrita pela IA | **Recusado** com a explicação da Meta (a IA só escreve depois que o lead responde); aparece na tela e no Iniciar |           |

## 8. Envio da primeira mensagem (Fase 8c)

> Este é o primeiro envio **real**. Use leads de teste seus.

| #   | Passo                                                 | Esperado                                                                                | Resultado |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| 8.1 | **Inicie** o disparo aprovado                         | As mensagens saem pelo número escolhido, respeitando ritmo, janela de horário e teto    |           |
| 8.2 | No WhatsApp do lead de teste                          | Chega **a mensagem aprovada** (a que você viu, com o nome)                              |           |
| 8.3 | No lead (CRM)                                         | "Novo lead" passa a **Abordagem**; na linha do tempo, **"Mensagem do disparo enviada"** |           |
| 8.4 | Cadência do lead                                      | Passo 1 dado como feito                                                                 |           |
| 8.5 | Tags                                                  | **"Abordagem: nome"** no contato                                                        |           |
| 8.6 | Painel de Prospecção                                  | O disparo é contado **uma vez** (sem nota duplicada)                                    |           |
| 8.7 | Disparo programado (agendado) que vira "em andamento" | O lead também vai para Abordagem                                                        |           |
| 8.8 | Contato que já pediu para parar                       | **Não recebe**                                                                          |           |

## 9. Continuação quando o lead responde (Fase 8d)

Abordagem de teste: Mensagem › Aguardar › Mensagem (IA) › Aguardar › Encaminhar.

| #    | Passo                                                                           | Esperado                                                                                               | Resultado |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| 9.0  | Depois que uma proposta da IA for escrita                                       | No painel aparece **"Custo da IA nesta continuação"** (soma das mensagens da IA); texto fixo não gasta |           |
| 9.1  | Depois do envio, abra o disparo                                                 | Painel **"Continuação da conversa"**: o lead aparece como **"Esperando a resposta"**                   |           |
| 9.2  | **Responda** do WhatsApp do lead (ex.: "tenho interesse, como funciona?")       | Em até ~15 s o painel mostra uma **mensagem proposta** e o que o lead respondeu                        |           |
| 9.3  | No CRM                                                                          | Cadência do lead **terminou**; ele **subiu** para Contato; tag **"Contato · Funil"**                   |           |
| 9.4  | A proposta é da IA?                                                             | Responde ao que o lead disse e leva a conversa adiante, em até 3 frases, sem inventar                  |           |
| 9.5  | **Edite** o texto e clique **Aprovar e enviar**                                 | A mensagem **editada** chega no WhatsApp do lead                                                       |           |
| 9.6  | Aprovar duas vezes seguidas (duplo clique)                                      | Chega **uma** só                                                                                       |           |
| 9.7  | **Pedir outra à IA**                                                            | O texto é reescrito                                                                                    |           |
| 9.8  | **Pular este passo**                                                            | O fluxo segue sem enviar                                                                               |           |
| 9.9  | **Encerrar o fluxo**                                                            | O lead sai do fluxo ("encerrado por você")                                                             |           |
| 9.10 | Responda uma **segunda vez** (depois do segundo "aguardar")                     | O fluxo anda de novo (a 2ª e a 3ª respostas contam)                                                    |           |
| 9.11 | Chegue ao passo **Encaminhar**                                                  | Cria **tarefa** para o dono do lead ("Continuar a conversa com…"), com aviso                           |           |
| 9.12 | Lead **sem dono** no passo Encaminhar                                           | O painel diz que ele não tem responsável                                                               |           |
| 9.13 | O lead responde **"pare"** / "não quero receber"                                | Fluxo **parado** (pediu para não receber mensagens) e **nada** é proposto                              |           |
| 9.14 | Deixe um lead **sem responder** além do prazo do "aguardar"                     | Fluxo **concluído** ("não respondeu no prazo") na próxima varredura (até 15 min)                       |           |
| 9.15 | Aprove uma proposta **mais de 24 h depois** da resposta, num número **oficial** | O canal recusa: "A mensagem não saiu"; o fluxo segue esperando sua decisão                             |           |
| 9.16 | O agente de IA do inbox também pode responder esse lead                         | Verifique se **duas respostas** não chegam ao mesmo tempo (ponto de atenção)                           |           |

## 10. Áudio na continuação (Fase 8e)

Abordagem com um passo de **áudio** (com arquivo escolhido) depois de um "aguardar".

| #    | Passo                                               | Esperado                                                                                | Resultado |
| ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| 10.1 | O lead responde e o próximo passo é o áudio         | A proposta aparece como **áudio** (nome do arquivo), com **"Aprovar e enviar o áudio"** |           |
| 10.2 | Clique em **Aprovar e enviar o áudio**              | O áudio **chega** no WhatsApp e toca                                                    |           |
| 10.3 | Passo de áudio **sem arquivo**                      | Recusa: "Este passo não tem um arquivo de voz"; resta **"Já mandei à mão"**             |           |
| 10.4 | Apague da biblioteca um áudio usado                 | Os passos ficam sem arquivo e o desenho avisa                                           |           |
| 10.5 | **Número oficial** com wav ou ogg que não seja Opus | Recusado **antes** de enviar, dizendo para usar ogg (Opus), mp3, m4a, aac ou amr        |           |
| 10.6 | Número oficial com ogg/mp3/m4a                      | Envia (**não testado em lugar nenhum**)                                                 |           |

## 11. Permissões e segurança

| #    | Passo                                  | Esperado                                                           | Resultado |
| ---- | -------------------------------------- | ------------------------------------------------------------------ | --------- |
| 11.1 | Entre com um usuário **agente/viewer** | Não aprova mensagens, não envia continuação, não sobe/remove áudio |           |
| 11.2 | Entre com **gestor**                   | Faz tudo acima                                                     |           |
| 11.3 | Duas organizações                      | Uma **não vê** áudios, disparos nem continuações da outra          |           |
| 11.4 | Modo suporte (somente leitura)         | Não consegue alterar nada                                          |           |

---

## 12. Como me contar o que encontrou

Para cada falha, mande:

1. O número do item (ex.: **9.5**).
2. O que você esperava e o que viu (um print ajuda muito).
3. Se for envio: número usado (oficial ou não), tipo de lead e horário.

Os pontos onde mais suspeito de problema: **9.2 a 9.5** (primeira resposta real), **8.1/8.2**
(primeiro envio real), **7.2** (qualidade da IA), **10.2** (áudio no WhatsApp) e **10.6** (áudio
no oficial).

## 13. O que ainda **não existe** (não é falha)

- Enviar sozinho (sem aprovação) a continuação — por enquanto é sempre aprovada à mão.
- Fluxo com ramificações (resposta positiva/negativa); hoje o fluxo é uma linha só.
- Mensagem automática ao cliente depois da falta.
- Destino "Nutrição" no fim da cadência; cadência fora de campanhas de Prospecção.

---

## 14. Agenda — visual estilo Google Agenda (26/10/2026)

Em **Agenda**. Teste no computador e no celular.

| #     | Passo                                                                                 | Esperado                                                                                                                                            | Resultado |
| ----- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 14.1  | Abra a Agenda                                                                         | Abre **direto no calendário**; não há mais "Próximos / Aguardando confirmação / Passados / Cancelados"                                              |           |
| 14.2  | Clique no botão da visão (mostra "Semana")                                            | Abre um menu com **Dia, 3 dias, Semana, Mês**; a visão atual está em destaque                                                                       |           |
| 14.3  | Escolha **3 dias**                                                                    | Três colunas, a partir do dia escolhido; as setas andam de 3 em 3 dias; o título mostra o intervalo                                                 |           |
| 14.4  | Escolha Dia, Semana e Mês                                                             | Cada uma desenha certo; o botão passa a mostrar o nome da visão                                                                                     |           |
| 14.5  | Na grade, olhe os horários                                                            | **Disponíveis em branco**; indisponíveis (fora da jornada, ocupados, passados) em **cinza**; compromissos com o bloco colorido                      |           |
| 14.6  | Clique num horário branco                                                             | Abre o novo compromisso naquele horário                                                                                                             |           |
| 14.7  | Clique num horário cinza                                                              | Nada acontece                                                                                                                                       |           |
| 14.8  | Troque o tipo de atendimento                                                          | A grade recalcula o que é branco e o que é cinza                                                                                                    |           |
| 14.9  | Recarregue a página                                                                   | Nada pisca todo em cinza antes de carregar                                                                                                          |           |
| 14.10 | **Celular — Dia**                                                                     | Uma coluna, com a data no topo e as horas à esquerda                                                                                                |           |
| 14.11 | **Celular — 3 dias**                                                                  | Três colunas, com a sigla do dia e o número empilhados                                                                                              |           |
| 14.12 | **Celular — Semana**                                                                  | As **sete colunas** juntas (antes só aparecia um dia); texto dos compromissos cortado, mas legível ao tocar                                         |           |
| 14.13 | **Celular — Mês**                                                                     | Grade do mês com até 3 faixas coloridas por dia e "+N" quando há mais                                                                               |           |
| 14.14 | Toque num compromisso (qualquer visão)                                                | Abre a página do compromisso                                                                                                                        |           |
| 14.15 | **Remarcar / Cancelar / Resultado**                                                   | Agora só pela **página do compromisso** (não há lista); confira que funcionam                                                                       |           |
| 14.16 | Quem **só lê** (viewer)                                                               | Vê a grade sem cinza e sem poder marcar (ver pendência 3b do plano da Agenda)                                                                       |           |
| 14.17 | **Celular — topo da Agenda**                                                          | Só aparecem **Novo agendamento**, **Hoje** (com as setas e o período) e o botão da visão; o calendário começa logo abaixo, sem título nem subtítulo |           |
| 14.18 | **Celular — fim da página**                                                           | No cartão "Agenda conectada" aparecem "Configurar suas agendas" e "Desconectar", e **embaixo deles** o botão "Sincronizar com Google", que funciona |           |
| 14.19 | **Computador**                                                                        | O botão "Sincronizar com Google" continua no topo, ao lado de "Novo agendamento", e o título "Agenda" aparece                                       |           |
| 14.20 | **Celular — filtro de pessoas**                                                       | O filtro de pessoas **aparece** no celular, embaixo de Hoje / Semana, antes do calendário (decisão final)                                           |           |
| 14.21 | **Computador — Mês**: olhe um dia com a rotina pessoal do Google (ex.: 05:00 e 05:40) | Essas faixas "Ocupado" fora de 07h–18h **não aparecem**; as de dentro da janela aparecem                                                            |           |
| 14.22 | **Mês**: dia com vários compromissos                                                  | Estão em **ordem cronológica** (6h, depois 9h, depois 14h…)                                                                                         |           |
| 14.23 | **Mês**: clique numa faixa de compromisso                                             | Abre a página do compromisso                                                                                                                        |           |
| 14.24 | **Mês**: clique na ocupação do Google                                                 | Não abre nada                                                                                                                                       |           |
| 14.25 | **Mês**: **duplo clique** num dia de hoje em diante                                   | Abre o novo compromisso já naquele dia (9h, ajustável)                                                                                              |           |
| 14.26 | **Mês**: duplo clique num dia **passado**                                             | Nada acontece                                                                                                                                       |           |
| 14.27 | **Mês**: duplo clique numa faixa                                                      | Abre/seleciona o compromisso e **não** cria um novo                                                                                                 |           |

---

## 15. Celular — acertos de tela (27/10/2026)

| #     | Passo                                                                        | Esperado                                                                                        | Resultado |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| 15.1  | **Agenda, celular**: olhe o topo (Hoje, período, botão da visão)             | O período ("25 out — 31 out") **não passa por cima** do botão da visão; nada quebra em 2 linhas |           |
| 15.2  | **Agenda, celular**: olhe a grade                                            | A grade ocupa mais da tela; o título "Agenda" some no celular                                   |           |
| 15.3  | **Barra de baixo**                                                           | Inbox, Agenda, CRM, Tarefas e Mais, nessa ordem                                                 |           |
| 15.4  | **Tarefas — calendário**: toque num dia                                      | Abre embaixo a lista do dia, com as propriedades escolhidas; "Nova tarefa" fica numa linha só   |           |
| 15.5  | **Tarefas — seletor de data**: toque fora dele                               | Fecha e salva a data, sem precisar do X                                                         |           |
| 15.6  | **Tarefas — linha do tempo**: arraste a borda da coluna do nome              | A largura da coluna muda e fica guardada                                                        |           |
| 15.7  | **Tabelas no celular** (Tarefas, Oportunidades…)                             | O texto **não é cortado**; dá para ajustar a largura das colunas                                |           |
| 15.8  | **CRM › Oportunidades — tabela**: olhe as colunas WhatsApp, Inbox, Ação      | Os botões ficam **numa linha só**, sem texto sobreposto                                         |           |
| 15.9  | **Marketing, celular**: cartões, links, "Apagar subpágina", abrir uma página | Textos dentro dos cartões; o botão de apagar é pequeno; a página abre no topo                   |           |
| 15.10 | **Produtos**: mude o preço de um produto pela tabela                         | O valor **fica salvo** (não volta ao anterior)                                                  |           |
| 15.11 | **Marketing › Modelos**: abra o menu numa página                             | Só aparecem **Página em branco** e o modelo **daquele tipo de página**                          |           |

---

## 16. CRM — visualização padrão (27/10/2026)

| #    | Passo                                            | Esperado                                                                    | Resultado |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------------- | --------- |
| 16.1 | **Oportunidades**: olhe a primeira aba           | O nome diz o que ela é ("Quadro" ou "Tabela") e ela se comporta assim       |           |
| 16.2 | Abra a configuração da visualização padrão       | Dá para trocar o tipo (tabela ↔ quadro) **mantendo filtros e propriedades** |           |
| 16.3 | **Duplicar** a visualização padrão               | Nasce uma cópia com os mesmos filtros e propriedades                        |           |
| 16.4 | **Apagar** a visualização padrão (havendo outra) | Ela some das abas; se não houver outra, a opção de apagar não aparece       |           |

---

## 17. Tarefas adiadas e autoavaliação da semana (27/10/2026)

| #    | Passo                                                                    | Esperado                                                                                                      | Resultado |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------- |
| 17.1 | **Cronograma › Tarefas adiadas**                                         | **Não existe** mais o filtro "Só as sem motivo registrado"                                                    |           |
| 17.2 | Adie uma tarefa **sem escrever o motivo**                                | Não deixa: o motivo é obrigatório                                                                             |           |
| 17.3 | **Cronograma › Tarefas da semana** (como gerente): olhe embaixo da lista | Aparece "Autoavaliação da semana": barra de 0 a 100% e campo de tópicos                                       |           |
| 17.4 | Dê uma nota, escreva tópicos e salve                                     | Aparece "Autoavaliação salva" e a semana entra no histórico como "Semana dd/mm/aa → dd/mm/aa — NN% — tópicos" |           |
| 17.5 | Troque de semana e volte                                                 | Cada semana mostra a **sua** nota e as suas anotações                                                         |           |
| 17.6 | Abra o cronograma como **cliente** (visão do cliente / link público)     | A autoavaliação **não aparece**                                                                               |           |

---

## 18. Agenda — mês com painel do dia e propriedades (27/10/2026)

| #    | Passo                                                                                              | Esperado                                                                                       | Resultado |
| ---- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| 18.1 | **Agenda › Mês**: toque num dia                                                                    | Abre embaixo o painel com os compromissos dele, em ordem de horário                            |           |
| 18.2 | **Celular**: olhe as células do mês                                                                | Só **pontinhos coloridos** por responsável; no computador, as faixas                           |           |
| 18.3 | No painel, toque num compromisso                                                                   | Abre a página do compromisso                                                                   |           |
| 18.4 | **Novo agendamento** no painel                                                                     | Abre já no dia escolhido (a partir de hoje)                                                    |           |
| 18.5 | **Propriedades**: marque/desmarque itens                                                           | A lista sob cada compromisso muda; ao recarregar a escolha **continua** (fica neste navegador) |           |
| 18.6 | Marque Tipo, Categoria, Link, Ligar, E-mail, Inbox, Funil, Status do funil, Status da venda, Valor | Aparecem os valores certos do compromisso e da oportunidade ligada a ele                       |           |
| 18.7 | Compromisso sem oportunidade ou sem link                                                           | Mostra "—" nesses campos, sem erro                                                             |           |

---

## 19. Remarcação, no-show e venda (27/10/2026)

| #     | Passo                                                                             | Esperado                                                                                        | Resultado |
| ----- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- |
| 19.1  | **Arraste** um compromisso aberto para outro horário                              | O antigo vira **Não compareceu** (conta no no-show) e nasce um **novo** no horário escolhido    |           |
| 19.2  | Remarque pela **data e hora** da página do compromisso                            | Mesmo efeito, e a página passa a mostrar o **compromisso novo**                                 |           |
| 19.3  | Abra o compromisso antigo                                                         | Status **Remarcado**; no novo, "Remarcado de" mostra o horário anterior (propriedade do painel) |           |
| 19.4  | O novo tem o mesmo cliente, oportunidade, responsável, tipo e anotações do antigo | Sim                                                                                             |           |
| 19.5  | Olhe as **análises / no-show**                                                    | A remarcação **conta** como não comparecimento                                                  |           |
| 19.6  | O cliente recebe mensagem ao remarcar                                             | Recebe **uma** mensagem (a de compromisso marcado), não duas; **não** recebe "você faltou"      |           |
| 19.7  | Remarque para um horário que **não cabe** (ocupado)                               | Recusa com erro e o compromisso **continua como era** (não vira falta)                          |           |
| 19.8  | **Resultado** do compromisso: Compareceu e comprou                                | Status **Compareceu e Comprou** e abre o pagamento da oportunidade                              |           |
| 19.9  | Registre o pagamento (ou marque a venda como Paga/Comprometida pela oportunidade) | As reuniões já realizadas dessa oportunidade viram **Compareceu e Comprou** sozinhas            |           |
| 19.10 | Resultado: Compareceu e não comprou                                               | Status **Compareceu e Não comprou**; pergunta o destino da oportunidade                         |           |
| 19.11 | Resultado: Não compareceu                                                         | Status **Não compareceu**                                                                       |           |
| 19.12 | Tente registrar resultado de reunião que **ainda não começou**                    | Não deixa ("Disponível quando a reunião começar")                                               |           |
| 19.13 | Anote se o espelho do **Google Agenda** ficou certo depois de remarcar            | O evento antigo some/não confunde e o novo aparece (**ponto a conferir**)                       |           |

---

## 20. Página do compromisso (27/10/2026)

| #     | Passo                                                                | Esperado                                                                                                              | Resultado |
| ----- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| 20.1  | Abra um compromisso                                                  | Título no topo (ex.: "R1 · Nome do cliente"), **tag do tipo no canto superior direito**, depois as propriedades       |           |
| 20.2  | Clique na tag do tipo e escolha outro                                | O tipo muda e o **fim** acompanha a duração do novo tipo                                                              |           |
| 20.3  | **Data e Hora**: troque o início                                     | Remarca (19.2); mostra "até HH:mm"                                                                                    |           |
| 20.4  | **Status**: clique na tag                                            | Opções: Confirmado, Compareceu e Comprou, Compareceu e Não comprou, Não compareceu (as de resultado só após o início) |           |
| 20.5  | **Responsável**: troque                                              | Só aparecem atendentes do tipo livres naquele horário                                                                 |           |
| 20.6  | **Cliente**: ícone do Inbox                                          | Abre a conversa do cliente no Inbox                                                                                   |           |
| 20.7  | **Cliente**: ícone de ligar                                          | Abre a ligação com o telefone do cliente                                                                              |           |
| 20.8  | **Cliente**: ícone de trocar                                         | Busca um cliente; ao trocar, a **oportunidade e a venda** passam a ser as do novo cliente                             |           |
| 20.9  | **Link da Reunião** (Meet): link pronto                              | Mostra o link, com botão de **copiar** e de **abrir**                                                                 |           |
| 20.10 | Link pendente ou com falha                                           | Mostra "Gerando o link…" ou "Falha ao gerar o link" no lugar do link                                                  |           |
| 20.11 | Compromisso **presencial**                                           | O rótulo vira "Endereço"; copiar e abrir no mapa                                                                      |           |
| 20.12 | **Oportunidade**                                                     | Nome + etapa do funil na mesma linha, e o funil embaixo; cliente com várias oportunidades permite escolher            |           |
| 20.13 | **Venda**: produto de interesse, valor e status na mesma linha       | Mudar para Comprometida / Não comprou funciona; **Paga** abre o pagamento                                             |           |
| 20.14 | Venda paga ou comprometida                                           | Abre embaixo o resumo (Valor, Pago, A receber) e as parcelas                                                          |           |
| 20.15 | **Editor de blocos** em compromisso novo de reunião de vendas        | Já vem com o roteiro de vendas (Abertura, Diagnóstico… Fechamento) para escrever embaixo de cada passo                |           |
| 20.16 | Escreva no editor, espere "Salvo neste compromisso", feche e reabra  | O texto continua lá                                                                                                   |           |
| 20.17 | Adapte os blocos de **um** compromisso                               | **Outro** compromisso do mesmo tipo continua com o modelo original                                                    |           |
| 20.18 | "Voltar ao modelo do tipo"                                           | O compromisso volta ao modelo do tipo                                                                                 |           |
| 20.19 | Compromisso antigo que tinha anotações no campo antigo               | As anotações aparecem como bloco "Anotações anteriores"                                                               |           |
| 20.20 | **Configurações › Tipos de agendamento › Editar o modelo de blocos** | Editar e salvar muda o modelo dos compromissos **ainda não adaptados** desse tipo                                     |           |
| 20.21 | Quem **só lê** (viewer)                                              | Vê os blocos sem editar; sem botões de trocar/remarcar                                                                |           |
| 20.22 | **Celular**: abra a página do compromisso                            | Propriedades legíveis, sem texto sobreposto; o editor de blocos cabe na tela                                          |           |

---

## 21. Agenda — painel do dia na semana e nos 3 dias; propriedades no Dia (28/10/2026)

| #     | Passo                                                               | Esperado                                                                                                 | Resultado |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- |
| 21.1  | **Semana**: toque no cabeçalho de um dia (ex.: "qui 29")            | Abre **embaixo da grade** o painel com os compromissos daquele dia; o cabeçalho escolhido fica destacado |           |
| 21.2  | **3 dias**: mesmo teste                                             | Mesmo comportamento                                                                                      |           |
| 21.3  | Ao abrir a Semana / 3 dias                                          | O painel já vem no dia de hoje (ou no primeiro dia, se hoje não está na faixa)                           |           |
| 21.4  | No painel, botão **Propriedades**                                   | A mesma escolha do mês (guardada neste navegador); as propriedades aparecem sob cada compromisso         |           |
| 21.5  | **Novo agendamento** no painel                                      | Abre já no dia aberto (a partir de hoje)                                                                 |           |
| 21.6  | **Celular**: Semana e 3 dias                                        | A grade tem altura própria; o painel fica logo abaixo, sem cortar nada                                   |           |
| 21.7  | **Dia**: olhe o topo da grade                                       | **Não há** painel embaixo; só o botão **Propriedades**                                                   |           |
| 21.8  | **Dia**: marque 5 ou 6 propriedades                                 | As propriedades aparecem **dentro de cada compromisso** e as **horas ficam mais altas** para caberem     |           |
| 21.9  | **Dia**: dois compromissos próximos (ex.: 9h e 9h30)                | Um **não fica em cima do outro**: o espaço entre eles se expande                                         |           |
| 21.10 | **Dia**: desmarque todas as propriedades                            | A grade volta à altura normal                                                                            |           |
| 21.11 | **Dia**: arraste um compromisso para remarcar, com horas expandidas | O fantasma do arraste cai no horário certo (a conta acompanha a altura nova)                             |           |
| 21.12 | **Dia**: clique num compromisso                                     | Abre a página do compromisso (as propriedades no bloco são só texto, sem links aninhados)                |           |
| 21.13 | **Celular**: olhe o topo da Agenda                                         | O título **"Agenda"** aparece em cima do botão "Novo agendamento"                                          |           |
| 21.14 | **Mês**: duplo clique num dia que **já passou**                            | Aparece um aviso do app: "Não é possível agendar em um dia que já passou."; nada abre                       |           |

---

## 22. Página do compromisso — ajustes de 28/10/2026

| #    | Passo                                                                       | Esperado                                                                                                           | Resultado |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| 22.1 | Abra um compromisso e olhe o topo                                           | Da esquerda para a direita: **tag colorida do tipo**, **lixeira vermelha**, **X**; o título logo abaixo            |           |
| 22.2 | O tipo mostra o nome certo (ex.: "Reunião de vendas"), e não "Atendimento"  | Sim; compromisso com tipo mostra a cor própria                                                                     |           |
| 22.3 | Clique na tag do tipo e escolha outro                                       | O tipo muda e o fim acompanha a duração do novo tipo                                                               |           |
| 22.4 | Clique na lixeira                                                           | Pede confirmação ("Excluir de vez?") antes de apagar                                                               |           |
| 22.5 | **Data e hora**                                                             | Uma linha só: data/hora e "até HH:mm"; **sem** texto de aviso embaixo; no celular não quebra                       |           |
| 22.6 | Status e Responsável                                                        | Lado a lado no computador, um embaixo do outro no celular; o status é uma tag colorida                             |           |
| 22.7 | **Reunião — presencial**: edite o endereço e saia do campo                  | Grava ("Local atualizado") e continua ao reabrir                                                                   |           |
| 22.8 | **Reunião**: troque a tag para **Link** e escreva um link                   | Grava; o botão "abrir" abre o link; o botão de copiar copia                                                        |           |
| 22.9 | Reunião com **Google Meet**                                                 | Mostra o link do Meet (ou "Gerando o link…" / "Falha ao gerar o link"); só se troca mudando o tipo                 |           |
| 22.10| **Oportunidade — computador**                                               | Nome, **etapa (tag colorida)** e funil na **mesma linha**                                                          |           |
| 22.11| **Oportunidade — celular**                                                  | O nome fica numa linha, e etapa e funil quebram embaixo, legíveis                                                  |           |
| 22.12| Botão **Abrir oportunidade**                                                | Abre a página padrão da oportunidade no CRM                                                                        |           |
| 22.13| Clique na **etapa** e escolha outra                                         | A etapa muda aqui e **também no funil/CRM**; etapa de perda pede o motivo; etapa de ganho pede o pagamento         |           |
| 22.14| **Venda**: produto, valor e status                                          | Numa linha no computador; quebra em linhas no celular; o status é uma etiqueta colorida editável                   |           |
| 22.15| Mude o status da venda (Comprometida / Paga / Não comprou)                  | Reflete na página da oportunidade e no CRM                                                                         |           |
| 22.16| **Oportunidade › Próxima ação**: escreva e saia do campo; escolha uma data | Grava ("Próxima ação atualizada") e aparece igual na **página da oportunidade** e no CRM                           |           |
| 22.17| **Oportunidade › Previsão de fechamento**: escolha uma data                | Grava e aparece igual na página da oportunidade                                                                     |           |
| 22.18| **Oportunidade › Origem**                                                   | É um **toggle fechado**, com o resumo (campanha · origem) na linha; ao abrir, dá para trocar campanha, criativo, landing page e origem em texto |           |
| 22.19| Quem só lê (viewer)                                                         | Próxima ação, previsão e origem aparecem **travadas**                                                              |           |
| 21.15 | **3 dias / Semana / Dia**: dia com ocupação do Google às **05:40**           | Nada aparece em cima do cabeçalho do dia (nome e número); o evento só aparece dentro da janela de horas da grade |           |
| 21.16 | Escolha **Mês**, saia da Agenda e volte (ou atualize a página)              | A Agenda volta no **Mês**; o mesmo vale para Dia, 3 dias e Semana                                                |           |

---

## 23. Página da venda e status único (28/10/2026)

| #    | Passo                                                                                  | Esperado                                                                                                              | Resultado |
| ---- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- |
| 23.1 | **CRM**: na coluna **Venda**, clique no nome da venda                                  | Abre a **página da venda**: Título da oportunidade, Status da venda, Produtos e ticket médio, Pagamento, Anotações    |           |
| 23.2 | Na mesma página, procure funil, cliente, origem, previsão, lembrete                    | **Não aparecem** (são da oportunidade); não há botão de apagar                                                        |           |
| 23.3 | Mude o **título** na página da venda e salve                                           | O título da **oportunidade** muda junto (e o contrário também)                                                         |           |
| 23.4 | Escreva uma **anotação** na venda                                                      | Aparece em **Comentários** na página da oportunidade (e vice-versa)                                                    |           |
| 23.5 | **Produtos e ticket médio**: venda com 2 ou mais produtos                              | Mostra o total e o **ticket médio por produto**                                                                       |           |
| 23.6 | **Pagamento**: forma, parcelas, recebidas e pendentes, recorrência                      | Funciona como antes; o status muda conforme as parcelas                                                               |           |
| 23.7 | Abra a **oportunidade** (nome da oportunidade no CRM / quadro)                          | Continua a página **completa** de sempre                                                                              |           |
| 23.8 | **Compromisso**: clique no status da venda                                              | Lista as **seis** opções, com os mesmos nomes e cores da página da venda: Possível venda, Comprometido, Pago, Recorrência ativa, Recorrência encerrada, Cancelado |           |
| 23.9 | No compromisso, escolha **Pago**                                                       | Abre a **página da venda** para registrar o pagamento                                                                 |           |
| 23.10| No compromisso, escolha **Cancelado**                                                  | Abre a página da venda já pedindo o **motivo** do cancelamento                                                        |           |
| 23.11| No compromisso, escolha **Comprometido** ou **Recorrência ativa**                      | Grava na hora e o status muda também na página da venda e da oportunidade                                             |           |
| 23.12| **Celular**: seção Oportunidade e Venda do compromisso                                  | Tudo cabe na largura da tela (nada some pelo lado direito)                                                            |           |
| 23.13| **Compromisso › Oportunidade › Abrir oportunidade**                                    | Abre o **popup da oportunidade por cima** do compromisso (sem trocar de página); ao fechar, volta ao compromisso no mesmo ponto |           |

| 21.17 | **Celular**: arraste o dedo da **direita para a esquerda** sobre a grade           | Vai para o **próximo** período (Dia, 3 dias, Semana ou Mês, conforme a visão), como a seta ">"                  |           |
| 21.18 | **Celular**: arraste da **esquerda para a direita**                                 | Volta ao período **anterior**, como a seta "<"                                                                    |           |
| 21.19 | Role a grade para cima/baixo (movimento vertical)                                   | **Não** troca o período                                                                                           |           |
| 21.20 | Arraste um **compromisso** para remarcar (segurando o cartão)                       | Continua remarcando; **não** troca o período                                                                      |           |
| 23.14| Abra a **página da venda** e a **da oportunidade** no celular                           | Popup com **bordas arredondadas** (não colado nas bordas da tela), cartões arredondados e o **título editável em cima** |           |
| 23.15| Edite o título no topo de uma delas e salve                                              | O título muda nas duas páginas (e no compromisso)                                                                     |           |
| 23.16| **Produtos e ticket médio** no celular                                                   | O produto ocupa a linha inteira e o valor e a lixeira ficam na linha de baixo; nada de texto espremido                |           |
| 23.17| **Abrir a oportunidade** pelo relatório de atividades e pela captação                        | Clicar no nome da oportunidade (Atividades) ou em "Ver o lead no funil" (Captações) abre o popup por cima; fechar volta à tela |           |
| 23.18| **Parcelas automáticas** na página da venda | Com valor preenchido, a parcela 1 já aparece (vencimento, valor, recebida); mudar o total ou a data refaz a tabela; editar uma parcela na mão para de refazer |           |
| 23.19| **Abrir sem teclado** no celular | Abrir uma venda ou oportunidade existente não levanta o teclado nem seleciona o título; tocar no título edita |           |
| 23.20| **Status editável** no resumo do dia da Agenda | Tocar no status de um compromisso embaixo do calendário abre as opções; escolher atualiza na hora; resultado só vale depois do início da reunião |           |
| 23.21| **Responsável editável** no resumo do dia (ligar a propriedade Responsável) | Tocar no nome abre a equipe; escolher troca o responsável e avisa sobre o Google |           |
| 23.22| **Aviso "Ocupação do Google ainda não verificada"** | Com o Google sincronizado há pouco, o aviso não aparece ao ver o mês atual; só aparece se a sincronização estiver velha (>30 min), com erro ou o período passar da janela (~90 dias à frente) |           |
| 23.23| **Clientes pela agenda removido** | Configurações › Agenda não mostra mais "Clientes pela agenda"; novo agendamento não etiqueta o contato como cliente |           |
| 23.24| **Registro do resultado da reunião** | O texto explica que vale depois da reunião e o que cada prazo faz; o campo "Soltar o horário…" não existe mais e pedido não confirmado não é cancelado sozinho |           |
| 23.25| **Ver a agenda dos colegas** (como administrador) | Desligar "Atendentes podem ver a agenda dos colegas": um atendente passa a ver só os próprios compromissos (grade, resumo do dia e lista de pessoas); gerente/administrador seguem vendo todos; só administrador consegue mudar as duas opções |           |
| 23.26| **Filtro da Agenda** (gerente/administrador) | O botão "Filtrar" abre a lista de atendentes e de tipos com caixas; escolher um, vários ou todos muda a grade e o resumo do dia; o bloco "Ocupado" do Google segue só a pessoa; o botão resume o que está valendo |           |
| 23.27| **Tipos de atendimento** (celular) | Os seletores abrem o popup do app; não há campo de preço; dá para trocar Onde acontece e o endereço/link; o lembrete tem o botão "Inserir o link da reunião online (Meet)" e, numa reunião online com link pronto, a mensagem chega com o link |           |
| 23.28| **Página de atendimento do tipo** | O roteiro está dentro do editor de blocos (sem lista de passos nem caixa "Roteiro"); nada passa da borda no celular |           |
| 23.29| **Atendentes e horários** | Cada atendente é um cartão (status, carga, capacidade, horário e botão Editar); nada é cortado no celular |           |
| 23.30| **Horas da grade** | Em Configurações › Agenda › Horas da grade, escolher 08:00 a 17:00: a grade mostra só esse trecho; uma reunião às 18:30 faz aparecer as linhas até as 19:00 só enquanto existir |           |
| 23.31| **Linha do agora** | Com o dia de hoje destacado, a linha vermelha não aparece por cima do cabeçalho (TER 27) ao rolar |           |
| 23.32| **Título da oportunidade único** | O título é o mesmo campo no popup, na seção Oportunidade e na seção Venda do compromisso; editar num muda os outros |           |
| 23.33| **Datas da oportunidade** | Próxima ação e Previsão de fechamento abrem o calendário do app (com ícone), não o do sistema |           |
| 23.34| **Datas no seletor do app** | Em Anti-ban, Editar contato, Custos de captação, Honorários, Aplicar plano, ações em massa de Tarefas, Auditoria, Capturas e Adiar follow-up, o campo de data tem ícone e abre o calendário do app (e a hora, as colunas do app), nunca o do sistema |           |
| 23.35| **Perdas e Previsão no dashboard de Atendimento** | Na aba Atendimento aparecem, abaixo da tabela de leads esperando resposta, a Previsão e (gerente/administrador) as Perdas; trocar o período no topo muda as Perdas; atendente comum não vê as Perdas |           |
| 23.36| **Horas no seletor do app** | Horário de atendimento (dashboard), janelas dos atendentes, dias bloqueados, lembrete da venda, gatilhos/janela de follow-up dos agentes, ações em massa e modelos de tarefa, e o "Outro horário" do painel de marcação abrem as colunas de hora e minuto do app (nunca o relógio do sistema) |           |
| 23.37| **Ganhos e perdidos por atendente** | Em Dashboards › Atendimento, a tabela "Por atendente" tem as colunas Ganhos e Perdidos (a IA e "Sem responsável" mostram —); trocar o período muda os números |           |
| 23.38| **Atrito do atendimento** | Em Dashboards › Atendimento aparece o painel com silêncio, repetiu depois da passagem e espera na fila humana, cada um com sua nota; o período do topo muda os números; quem é só viewer não vê o painel |           |
| 23.39| **Automação e insistência no Atendimento** | Em Dashboards › Atendimento, abaixo do "Atrito do atendimento", aparecem os painéis "Automação" (4 números) e "Insistência e demandas abertas" (3 números), com as notas de cada um; o período do topo muda os valores |           |
| 23.40| **Dashboards concentram a análise** | O menu Análise só tem Faturamento, Honorários e Audit Log; não há Desempenho, Atividades nem Meta Ads ali; Dashboards tem 6 abas (Tráfego Pago, Prospecção Ativa, Comercial, Atendimento, Business, Atividades); a aba Atividades traz as duas abas de antes (Atividades e Por etiqueta) |           |
| 23.41| **Meta Ads só por Campanhas** | Em Marketing › Campanhas o atalho Meta Ads abre a página; ela não aparece mais no menu nem em Análise |           |
| 23.42| **Evolução da IA em IA** | "Ver tudo em IA" lista Evolução da IA em "Acompanhar o agente"; Análise não a lista mais |           |
| 23.43| **Régua do abandono no Atendimento** | O painel "Atrito do atendimento" mostra a régua (editável para gerente/admin) que antes ficava no Desempenho; /app/metrics e /app/activities redirecionam para os Dashboards |           |
| 23.44| **Finanças solta no menu** | O menu lateral tem "Finanças" junto de Início, CRM e Tarefas (ícone de dinheiro); Análise não lista mais Faturamento; a página mostra o título Finanças e os mesmos números; /app/faturamento redireciona |           |
| 23.45| **Sem Análise, Audit Log e Honorários no menu** | O menu lateral e a busca (⌘K) não têm mais o grupo Análise, o Audit Log nem Honorários; /app/analise redireciona para os Dashboards; o selo "mudado pelo assistente" aparece sem link; a agência ainda vê o histórico em /admin/audit |           |
| 23.46| **Finanças pelas vendas** | Em Finanças, escolha um período: "Entrou" soma as parcelas recebidas (e lançamentos avulsos pagos), "Saiu" as saídas lançadas, e aparecem vendas fechadas/canceladas, faturado, a receber no período, formas de pagamento, produtos, clientes e vendas por pessoa; nada vem de comanda |           |
| 23.47| **Conexões única, com Webhooks dentro** | O menu lateral mostra só Conexões (solta, por último, com o ponto de saúde); /app/webhooks leva a Conexões > Webhooks; as abas são Números por QR, API Oficial, Redes sociais e Webhooks, numa fila só que rola no celular; nenhum selo ("Não conectado") quebra em duas linhas |           |
| 23.48| **Título menor no compromisso** | Na página do compromisso, o título nas seções Oportunidade e Venda aparece em tamanho de texto normal, continua editável e sincronizado com o popup e a venda |           |
| 23.49| **Popup da oportunidade reorganizado** | Abra uma oportunidade: o topo tem Lembrete e lixeira, depois o título; seguem Cliente (toggle com celular, e-mail e campos; ícones de Inbox, ligar e abrir cliente), Funil com a etapa em tag editável, Score e motivo da perda, Responsável, Próximos passos, Compromissos e Tarefas (formato do Início; criar já leva cliente e oportunidade), Previsão, Produtos, Pagamento, os 3 números (pago, em interesse, comprometido), Comentários (descrição unida), Tags do cliente e Origem em toggle |           |
| 23.50| **Oportunidades enxuto no celular + funis múltiplos** | No celular: sem título/subtítulo; linha única com +, Ligar hoje, Prospecção e engrenagem; números em faixa que rola. Em qualquer tela: o botão "Funis" abre um popup com Todas, os funis (marque 1, 2 ou mais), Arquivados em toggle e o filtro por status/canal; com vários marcados a lista soma os funis; o desenho das etapas só aparece com 1 funil e em toggle |           |
| 23.51| **Vendas enxuto no celular + funis múltiplos** | Na aba Vendas, no celular: sem título, subtítulo e botão Clientes; o seletor de mês continua; números em faixa que rola; os chips (Recebeu no mês, Todas e as situações) numa fila só que rola; o botão "Funis" abre o mesmo popup de múltipla seleção das Oportunidades |           |
| 23.52| **Propriedades e visualizações de fábrica das Oportunidades** | Em Oportunidades existem as abas Conversão, Origem, Vendas e pagamentos, Perdas e Quadro de conversão (cada uma com suas colunas); o menu de propriedades lista as colunas novas (tempo na etapa, UTMs, motivo da perda…); campanha e funil são uma coluna só; clicar em "Oportunidades abertas" no topo filtra a lista sem erro; o popup de Funis cabe na tela e não abre o teclado sozinho; na aba Clientes aparecem Último e Próximo pagamento |           |
| 23.53| **Números da aba Vendas filtram** | Em Vendas, clique em Recebido no mês, A receber no mês, Em interesse ou Vendas fechadas: a lista mostra só as vendas que compõem o número e aparece o aviso com "Limpar"; os outros números não mudam; clique de novo para soltar; o Ticket médio não é clicável |           |
| 23.54| **Campanhas, período de Vendas e caixas redondas** | Em Oportunidades e Vendas o botão do filtro diz "Campanhas" (e o popup também); em Vendas o seletor de mês fica à direita do título, sem o botão "Clientes" (no celular o mês continua visível); as caixas de marcar do popup são arredondadas |           |
| 23.55| **Caixas redondas, popups na tela, Radar e botões da tabela** | Todas as caixas de marcar do app são arredondadas; o popup "+" de nova visualização cabe na tela (rola se preciso); a aba Radar mostra radar, tempo parado, última atividade, botões de agir e próxima ação (sem colunas soltas); na tabela de Oportunidades os botões (Ligar, WhatsApp, Inbox, Adicionar ação) não se sobrepõem às colunas vizinhas, mesmo com a coluna estreita |           |
| 23.56| **Atividade e Registro de ação na oportunidade** | No popup: sem o campo Referência; botão "Registro de ação" na linha do funil (mesmas opções da página do lead); registrar uma ação mostra o toast e ela aparece no toggle "Atividade" (no fim) e no histórico do lead; o toggle lista etapa movida, reunião, cancelamento, conversa e ações, só desta oportunidade |           |
| 23.57| **Cadência no Ligar hoje, cartões rotulados, ordem do menu** | Em Configurar a prospecção há a opção do passo da cadência; com ela ligada o Ligar hoje traz quem tem cadência para hoje, na frente; a coluna Cadência mostra "D+N · passo X de Y" (destaque quando é hoje); Próxima ação fica logo depois do nome em Conversão e Radar; não existe mais a coluna Resultado da ligação; nos cartões cada valor tem o nome da propriedade em letra pequena; ao ligar uma propriedade no menu ela vai para logo depois da última visível |           |

| 23.58| **Tags: categoria ao criar, busca colorida e barra do CRM fixa** | Na oportunidade o toggle Tags fechado mostra só "Tags"; "Adicionar tag" (aqui e na página do cliente) busca as tags existentes enquanto digita, mostrando-as coloridas; ao criar uma tag nova (gerente) dá para escolher a categoria ou criar uma nova; toda tag é colorida (sem categoria ganha um tom próprio) e começa com letra maiúscula; a barra CRM / Clientes / Oportunidades / Vendas / Lixeira fica fixa no topo enquanto a página rola |           |
| 23.59| **Próximos 5 dias e Transformar em tarefa** | Em Oportunidades o botão "Próximos 5 dias" mostra quem tem próximo passo de hoje até daqui a 4 dias (contador no botão, mais próximo primeiro); a aba "Próximos passos" faz o mesmo como visualização; no popup, com o próximo passo escrito, "Transformar em tarefa" cria a tarefa do lead com a data e aparece em Tarefas |           |
| 23.60| **Linha do tempo única** | O Histórico da página do cliente e a Atividade do popup da oportunidade têm o mesmo desenho (dia, trilho, ícone por tipo, quem, hora, detalhe); mover etapa, registrar ação, criar compromisso/tarefa e pagamento aparecem nos dois; a Atividade mostra só a oportunidade, o Histórico mostra o cliente todo |           |
| 23.61| **Anotações da oportunidade = anotações do lead** | No popup (e na página da venda) o bloco Anotações tem título opcional, texto e "Adicionar anotação", e mostra só as anotações daquela oportunidade; a anotação feita ali aparece no perfil do lead (aba Anotações) com o funil e a campanha; anotação feita no perfil sem oportunidade não aparece no popup; fixar e apagar funcionam nos dois lugares; comentários antigos viraram anotações |           |
| 23.62| **Clientes no celular compacto** | No celular, em CRM › Clientes: sem título/subtítulo, números (Total de leads, MQL, Faturamento…) numa faixa que rola de lado, botões Novo lead e Importar numa linha, Ciclo de vida mais baixo; no computador nada muda |           |
| 23.63| **Topo do lead enxuto** | Na página do lead: nome, telefone e e-mail, campos personalizados (só os campos), botões Ligar (abre o discador) e Inbox, e cada oportunidade aberta numa linha com funil e etapa (clicar abre a oportunidade); Excluir/Marcar pessoal/Desbloquear no menu ⋯ com a mesma confirmação; no celular as abas rolam de lado; as tags estão na aba Cadastro |           |
| 23.64| **Atalhos e ciclo no topo do lead** | No topo do lead: "Registrar ação" e "Registrar anotação" abrem a janela, gravam e aparecem no Histórico/Anotações; ao lado do telefone há a etiqueta do ciclo de vida (Novo lead, Em negociação…) e, clicando, o motivo e o Gestor de Relacionamento editável |           |
| 23.65| **Topo do lead editável** | Clicar no nome, telefone, e-mail ou num campo personalizado edita ali (Enter salva, Esc cancela); lead sem telefone/e-mail mostra "Adicionar telefone/e-mail"; o "+" cria campo (nome + valor) e ele aparece também no Cadastro; telefone inválido é recusado |           |
| 23.66| **Título grava ao sair do campo** | Abrir uma oportunidade pelo link na página do cliente, trocar o título, apertar Enter ou clicar fora: aparece "Título salvo" e, fechando e reabrindo, o título continua o novo (também na tabela e na lista de oportunidades do cliente) |           |
| 23.67| **Visão geral do lead em toggles** | Na página do lead não há mais a aba Cadastro; na Visão geral, abaixo do painel, há toggles (fechados mostram só o título): Compromissos, Tarefas, Oportunidades, Vendas, Anotações, Cadastro, Links, Qualificação, Origem, Ciclo de vida, Datas, Tags — cada um com o conteúdo e os botões de antes; o MQL é uma etiqueta no topo ao lado do ciclo (clicar marca/desmarca); `?aba=cadastro` abre a Visão geral |           |
| 23.68| **Gestor no topo e Visão geral em cartões** | No topo do lead há a etiqueta do Gestor de Relacionamento ao lado do "+" dos campos (clicar abre a escolha); a Visão geral usa cartões simples como a oportunidade (sem barra colorida) |           |
| 23.69| **Página do lead com 3 abas** | A página do lead só tem Visão geral, Linha do Tempo e LGPD (admin); Compromissos, Tarefas, Oportunidades, Vendas, Anotações, Cadastro e o resto estão em toggles na Visão geral; links antigos com `?aba=` de abas removidas abrem a Visão geral |           |
| 23.70| **Frases do Início** | A tela de Início mostra uma frase por dia, escolhida pela data, entre 33; a mesma frase para todos no mesmo dia, mudando à meia-noite |           |
| 23.71| **Modelos da aba Clientes** | Em CRM › Clientes, no "+" das visualizações aparecem Lista de clientes, Análise de Compras e Análise de Origem; escolher um cria a aba com as colunas dele (Origem já ordenada por origem); escolher de novo abre a que já existe |           |
| 23.72| **Venda paga exige dados e grava sozinha** | Marcar uma parcela como recebida (ou status Pago) sem produto, sem responsável ou sem forma de pagamento mostra o aviso do que falta e não grava (também pela API: erro `venda_incompleta`); numa oportunidade/venda existente, mudar produto, forma, parcela, responsável, previsão ou notas aparece "Salvando… / Salvo automaticamente" e persiste ao fechar sem apertar Salvar; Finanças não recebe mais venda paga "sem forma de pagamento" |           |
| 23.73| **Responsável em Finanças** | Trocar o responsável de uma oportunidade com venda paga e abrir Finanças: em "Vendas por pessoa" aparece o nome dele (não mais "Sem responsável"); nas Configurações › Financeiro, as regras de comissão listam e mostram os nomes da equipe |           |
| 23.74| **Visão geral do lead final** | Na Visão geral: 6 métricas (LTV atual, A receber, Em interesse, Compras, Ticket médio, Tarefas abertas); cartões Compromissos (Novo compromisso) e Tarefas (Nova tarefa) lado a lado; toggles Anotações (todas, sem formulário), Oportunidades e vendas (linha com nome, funil, status no funil, valor e status da venda; clicar abre; Nova oportunidade), Cadastro (nascimento + links: só os cadastrados, "Adicionar link" escolhe a rede), Origem, Datas (com Ativo até) e Tags; no celular o botão Categorias abre a caixa com filtro, lápis por categoria e Nova categoria; editar abre só aquela categoria, arredondada e sem teclado |           |
| 23.75| **Tabela de Vendas enxuta** | Em CRM › Vendas: a coluna Venda abre só a página simplificada da venda; Produto(s) com mais de um vira botão "N produtos" com a lista; existem Nº de parcelas, Recorrente, Recorrência e Valor mensal; não existem mais Previsão, Responsável, Origem, Campanha, Anúncio, Landing page e Posicionamento |           |
| 23.76| **Ordem dos grupos** | Em CRM › Clientes, Agrupar por Ciclo de vida mostra Novo lead no topo e Cliente ativo mais abaixo; em Agrupar › "Ordem dos grupos" escolher "Do último ao primeiro" inverte (e "Sem valor" segue por último); salvar a visualização guarda a ordem; vale também nas outras tabelas com agrupamento |           |
| 23.77| **Topo do lead como ficha** | Telefone com ícones de Copiar, Ligar e Inbox ao lado do número (copiar mostra "Telefone copiado"); na mesma linha: ciclo de vida, gestor ("Sem gestor de relacionamento" se vazio) e MQL; abaixo o e-mail com Copiar, e depois os campos e o "+"; a fileira de baixo só tem Registrar ação e Registrar anotação |           |
| 23.78| **Campos personalizados como propriedades** | Criar um campo (ex.: Idade) num lead; em CRM › Clientes, no menu de colunas aparece "Idade" (escondida até ligar) e vale para filtro, ordem e agrupamento; campos numéricos ordenam como número; no topo do lead, Ligar e Inbox ficam na fileira com Registrar ação e Registrar anotação e o telefone só tem o botão de copiar |           |
| 23.79| **Inbox limpo** | Na conversa só aparecem Assumir e "Opções" (Pesquisa, Liberar, Devolver ao automático etc. dentro); Lembrar › "Outro…" abre data e hora e avisa no horário; cartão da conversa na lista sem etiquetas; digitar "/" no campo mostra "Sugerir resposta com IA" e o bloco gigante só aparece quando há sugestão; no celular a conversa abre em tela cheia e o campo fica visível com o teclado |           |
| 23.80| **Configurações do Inbox** | No rodapé da lista aparece "Configurações do Inbox" e (com 2+ números) etiquetas coloridas dos números; clicar numa filtra a lista; na página: aba Etiquetas liga/desliga categorias e tags do filtro de tags, aba Respostas rápidas (some do menu lateral), aba Números salva nome e cor |           |
| 23.81| **Botões na linha (ficha)** | Cadastro: Salvar aparece ao lado da data de nascimento (só após editar); Origem: "Alterar origem" no fim da primeira linha; Tags: Categorias/Agrupar/Meus filtros/Ordenar à direita das tags; Oportunidade › Tarefas sem tarefa: texto à esquerda e "Nova tarefa" à direita |           |
| 23.82| **Ficha no Inbox** | Abrir uma conversa mostra a ficha: nome/celular/oportunidades, ciclo e MQL, Registrar ação/anotação, "LTV (gasto)" e "Potencial LTV", Notas importantes (as fixadas); toggles Tarefas e compromissos (botão único Novo → compromisso ou tarefa), Anotações (ícone arquivar some a nota da lista), Tags, Origem, Atividade (registrar ação + histórico) e Vendas; não há mais Acervo, Demandas abertas nem Leads recentes |           |
| 23.83| **Aviso de notificações** | No celular, com permissão ainda não decidida, o rodapé da lista mostra "Receber aviso de novas mensagens neste aparelho"; Ativar pede a permissão do navegador; o X some com o convite e ele não volta |           |
| 23.84| **Central de Automações** | Menu lateral (Atendimento) mostra "Automações" para gerente/admin; /app/automacoes abre nas abas Regras (criar, ligar/pausar, editar), Execuções, Follow-ups (link para IA › Follow-ups) e Ajustes (link para o freio da IA); a aba Automações em Conexões › Webhooks segue funcionando; agente/viewer é levado para /403 |           |
| 23.85| **Automações de tag** | Em Automações › Regras aparecem 3 modelos de tag; "Marcar quem enviar um texto" abre o editor já preenchido (mensagem recebida, texto contém "#obrigado", ação adicionar tag) — criar, mandar essa frase por WhatsApp e ver a tag no contato; "N mensagens": a 5ª mensagem do cliente põe a tag uma vez só; "Sem atendimento": silêncio em horas, direção "Sem atendimento", o cron lead-time-triggers (de hora em hora) põe a tag no lead cujo cliente escreveu e ninguém respondeu em 24h; regra antiga de silêncio continua em dias |           |
| 23.86| **Menu lateral** | Ordem: Início, Inbox (com contador da fila), Agenda, CRM, Tarefas, Financeiro, toggle Marketing (com Automações dentro), Agentes de IA (link único para /app/ai, com contador de casos), Conexões; não existe mais o toggle Atendimento nem o toggle de IA; vale também no menu do celular |           |
| 23.87| **Prova das automações de tag** | Instalação nova, sem regras: Automações › Regras mostra os 3 modelos; criar cada um, ligar, mandar por WhatsApp "#obrigado", duas mensagens e uma mensagem sem resposta (envelhecida 1h) → os contatos ganham `obrigado`, `engajado` e `sem atendimento`; Execuções lista as 3 com Sucesso; evidência em evidence/automacoes-de-tag/ |           |
| 23.88| **Baseline instalável** | Banco novo: `psql -v ON_ERROR_STOP=1 -f supabase/baseline.sql` termina sem erro, e reaplicar (modo update) também; `pnpm test:db` passa install e update; conferir que `crm_leads.notes`, `crm_lixeira` e `contacts.ciclo_de_vida` existem num banco recém-instalado |           |
| 23.89| **Menu lateral (2ª ordem)** | Ordem: Início, Tarefas, toggle Marketing (sem Automações), toggle Atendimento (Inbox, Agenda, CRM, Automações), Agentes de IA, Conexões e Financeiro em negrito no desenho do cabeçalho de toggle, sem seta; o contador da fila fica no Inbox, o de casos em Agentes de IA e a bolinha de saúde em Conexões; vale também no menu do celular |           |
| 23.90| **Endurecimento do banco** | `pnpm test:db` (pg15): install e update sem erro; `hardening-definer-varredura`, `definer-membership-varredura`, `avisos-do-security-advisor`, `agenda-nenhuma-tabela-sem-rls`, `rbac-config-ia-canais`, `lgpd-redact-unificado-alcanca-pelo-catalogo`, `agenda-presenca-acl`, `quadro-do-onboarding`, `nascimento-do-lead` e o novo `excluir-organizacao-com-oportunidades` verdes; apagar uma organização com lead não falha |           |
| 23.91| **Ficha do lead no Inbox** | Coluna de 296px sem rolagem horizontal (Atividade, topo e Vendas legíveis; celular de 390px também); sem botão Inbox na ficha; clicar numa venda abre a oportunidade; no cartão da oportunidade, digitar a próxima ação e Enter (ou escolher a data) grava em `crm_leads.proxima_acao` e continua ao recarregar |           |
