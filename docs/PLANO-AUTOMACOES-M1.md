# Plano das Automações do M1 (frente 19)

Criado em 01/11/2026. Decisões do Arthur: **uma central única** (regras de automação + follow-ups da IA, vistos e
gerenciados na aba Automações), **por categoria**, com **modelos prontos** (Anti-No-show e Follow-up primeiro),
**fluxo vertical** com espera e ramificação, e **motor único depois**, só quando houver dados de uso.
Ele ainda não criou nenhuma automação: este é o momento mais barato de decidir a arquitetura (nada a migrar).

## 0. Decisões do Arthur (01/11, tarde)
1. **Quais mensagens ao cliente são automáticas e quais só lembram a equipe?** Não há regra geral. Isso se decide **dentro
   de cada automação**, na hora de montar cada modelo. Cada modelo será construído **junto com o Arthur, um por vez**
   (ele avisa quando for a hora). Vale para a Fase 3 inteira.
2. **Anti-No-show:** quantidade de lembretes, horários antes da reunião e o que fazer quando o lead pede para remarcar
   são definidos **manualmente por cliente**. Existe um fluxo **padrão de modelo**, mas **todo ele é editável e
   personalizável** (cada cliente recebe a sua cópia). Consequência: o modelo é um ponto de partida que se **instala como
   cópia** (como a galeria de follow-ups já faz), e nunca um fluxo compartilhado e travado.
3. **Agente de IA publicado:** ainda **não existe**. O Arthur quer **revisar o funcionamento dos agentes antes** com o
   Claude. Por isso a ordem da Fase 3 muda (ver §4): primeiro a revisão dos agentes, depois os modelos.

**O que o código diz e ajuda nessa ordem** (`lib/followup/agent-followup-gate.ts`): um follow-up **só exige agente quando o grafo
usa IA** (classificar a resposta, espera inteligente ou mensagem escrita pela IA). Fluxo só com **texto fixo, modelo de
mensagem, "se a resposta contém…" e espera fixa não precisa de agente**. Então o Anti-No-show com lembretes de texto
fixo pode rodar **sem agente**; só o "entender em texto livre que o lead quer remarcar" depende de um agente.

## 0-bis. Decisão do Arthur (01/11, noite): automações primeiro, SEM agente de IA
Foco no desenvolvimento das automações **sem agente de IA**. A revisão dos agentes (`docs/PLANO-AGENTES-M1.md`) acontece
depois, e só então a IA é integrada às automações "de forma melhor". Por isso:
- **Fases 3 a 5 ficam sem IA:** modelos com texto fixo, modelo de mensagem, "se a resposta contém…" e espera fixa (o motor de
  follow-up já roda assim, sem agente publicado). Nada de classificar por IA, espera inteligente ou mensagem escrita por IA.
- **Nova fase 7 — Integrar a IA às automações:** depois da revisão dos agentes. Agente em modo Assistido primeiro; os passos de
  IA entram nos fluxos que já existirem. Nenhuma automação sem IA precisa ser refeita para receber a IA depois.
- A frente 11 (agentes) continua no plano, mas **não bloqueia** as automações.

**Próximos passos de engenharia, em ordem (sem IA):**
1. **Anti-No-show construído junto com o Arthur** (follow-up só com texto fixo e espera fixa): ele define, para o primeiro
   cliente, número e horários dos lembretes, textos, o que fazer quando o lead responde (palavras como "remarcar", "não vou") e o
   que a equipe recebe. Vira o fluxo padrão de modelo, copiável e editável por cliente.
2. **Proteções:** botão geral "Pausar todas as automações", limite de mensagens por lead e por dia, e **modo de teste**
   (mostrar o que a regra faria sem executar). O motor já tem trava de contato pessoal, ritmo (throttle) e janela do canal;
   falta o freio geral e a simulação.
3. **Editor visual** da regra pelo fluxo vertical (adicionar, reordenar, configurar), e depois espera e "se… senão".
4. Demais modelos (lead que não respondeu, compareceu e não comprou, pós-venda), um por vez.

## 1. Inventário (fase 1, feita em 01/11)

**Motor de regras** (`lib/automation`, tela `app/app/automacoes` + `app/app/webhooks/_components`): uma regra é
**um gatilho + até 10 condições (todas valem) + até 10 ações em ordem**. Linear, sem espera nem ramificação.
- **Gatilhos (20):** lead novo; mudou de etapa; negócio ganho, perdido ou reaberto; responsável mudou; mensagem
  recebida; mensagem não entregue; tag no lead; tag no contato; horário marcado, confirmado, remarcado, cancelado,
  compareceu, faltou; aniversário; N dias para uma data do funil; N dias sem mensagem; N dias na mesma etapa.
- **Ações (9 + IA):** criar/mover lead no funil; enviar WhatsApp; mensagem escrita pela IA; adicionar tag; atribuir
  atendente; avisar outro sistema (webhook); iniciar fluxo de mensagem; criar tarefa interna; aplicar plano de
  tarefas; e a "IA decide" (escolhe entre 2 e 6 ações, com custo de token declarado).
- Já tem: execuções com histórico, liga/desliga por regra, selo de quem mexeu, freio da "IA decide", modelos de tag.

**Motor de follow-up** (`lib/followup`, `app/app/ai/followups`): **canvas** (`@xyflow/react`) com nós de gatilho,
espera, condição, classificação por IA, resposta, repetição, coleta, habilidade, ação, tarefa interna, mover lead, tag e
fim, com ramos nomeados e versões publicadas. Galeria de modelos (hoje só de clínica). O fluxo nasce **rascunho** e só
dispara com um agente **publicado** armando o ponteiro. Fila e execuções por lead.

**Sobreposição:** tarefa interna, mover lead e tag existem nos dois motores com a mesma semântica. Espera, ramificação,
IA e conversa só existem no motor de follow-up. É por aí que os dois se unem no futuro.

## 2. Arquitetura alvo
Um **fluxo** = gatilho + passos (condição, espera, ramificação, ação, IA) com um catálogo único de ações. A regra simples
de hoje é o caso particular "sem espera nem ramo". Enquanto não unificamos o motor, a **Central** mostra os dois
juntos, com as mesmas categorias, o mesmo vocabulário e os mesmos modelos.

## 3. Categorias (decididas)
Captação · Follow-up e atendimento · Agenda e no-show · Vendas e pós-venda · Organização interna · Integrações.
Regra: a categoria de uma regra sai do **gatilho** (e de "avisa outro sistema" = Integrações); a de um fluxo de follow-up,
do **nome** (provisório; vira uma coluna própria na unificação). Código: `lib/automation/categorias.ts`.

## 4. Fases

| Fase | O que | Estado |
| --- | --- | --- |
| 1 | Inventário dos dois motores e catálogo/categorias | **Feita** (esta seção) |
| 2 | **Central única** na aba Automações: filtro por categoria com contagem; regras e follow-ups na mesma lista; botão "Ver como fluxo" (coluna Quando → Se → Então, só leitura, serve no celular); modelos prontos por categoria | **Feita (1ª entrega, 01/11)** |
| 2b | Modelos prontos que ficam válidos sem escolher canal ou pessoa (tarefas e tags): 9 novos (primeiro contato, lead sem resposta, lead parado na etapa, **Anti-No-show: recuperar quem faltou**, confirmar reunião marcada, follow-up de quem compareceu, pós-venda do negócio ganho, reativar negócio perdido, aniversário) | **Feita** |
| 3a | **Revisão dos agentes de IA, com o Arthur** (ver `docs/PLANO-AGENTES-M1.md`): o que existe, para que serve cada peça, qual agente a M1 precisa, chave de IA e custo. Pré-requisito para tudo que usa IA | **Próxima** |
| 3b | **Modelos de follow-up M1, um por vez e construídos junto com o Arthur** (janela de envio e anti-banimento): Anti-No-show (cópia editável por cliente), Lead que não respondeu e Compareceu e não comprou. A galeria hoje é só de clínica: criar o nicho "agência/comercial" | A fazer |
| 4 | **Editor visual** da regra pelo fluxo vertical: "+" entre os passos, reordenar, painel lateral com os formulários que já existem; depois, espera e "se… senão" | A fazer |
| 5 | **Catálogo novo de ações/gatilhos** (ver §5), sempre uma de cada vez | A fazer |
| 6 | **Motor único**: decidir com dados de uso reais (quais automações o Arthur realmente roda) | A decidir |
| 7 | **Integrar a IA às automações** (depois da revisão dos agentes; Assistido primeiro) | Depois da frente 11 |

## 5. Catálogo: o que considerar acrescentar (backlog, a decidir item a item)
- **Ações:** avisar na Central de Avisos/push (casa com a frente 16); criar compromisso; mover etapa; enviar e-mail;
  mudar responsável por rodízio; marcar o lead como "quente"; pausar outros fluxos do lead.
- **Gatilhos:** lead sem resposta há N horas (já existe por tempo); parcela vencida; venda paga; lead respondeu um
  formulário; meta do cronograma atingida ou em risco.
- **Passos de fluxo:** espera ("2 dias úteis", "até as 9h"), "se respondeu / se não respondeu", "se tem a tag X".

## 6. Proteções (valem para toda automação nova)
1. **Modo de teste**: rodar sem enviar nada e mostrar o que faria (a fazer; é pré-requisito do editor visual).
2. **Freio**: limite por lead e por dia, botão geral de pausar todas as automações, e proteção contra laço
   (a regra se dispara sozinha; o schema já recusa o laço de lead).
3. **WhatsApp**: sempre pela cadeia de envio (janela 7h–22h, ritmo, opt-out). Automação não fura essa fila.
4. **Rastro**: toda execução aparece em Execuções, com o motivo de não ter rodado.
5. **Quem ligou**: selo de autoria já existe; mantido.

## 7. Testes
- Modelos conferidos contra o **mesmo schema da API** (`lib/automation/modelos-prontos.test.ts`).
- Categorias e passos da regra são funções puras com teste (`categorias`, `passos-da-regra`).
- Prova pela tela (roteiro 23.139): criar a partir de um modelo, ver como fluxo, filtrar por categoria, ligar e pausar.

## 8. Perguntas em aberto
1. (Respondida na §0: definido modelo a modelo.) 2. (Respondida: por cliente, editável.) 3. (Respondida: não há agente; revisar primeiro.)
4. Para a revisão dos agentes: ver as perguntas em `docs/PLANO-AGENTES-M1.md`.
