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
