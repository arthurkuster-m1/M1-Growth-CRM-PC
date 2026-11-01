# Revisão dos Agentes de IA do M1 (frente 11)

Criado em 01/11/2026. Objetivo: antes de publicar qualquer agente, **o Arthur entende o que cada peça faz** e decidimos juntos
quais agentes a M1 precisa, com que papel, limites e custo. Nada é publicado sem o OK dele. Esta revisão é pré-requisito dos
follow-ups que usam IA (`docs/PLANO-AUTOMACOES-M1.md`, fase 3).

## 0. Respostas do Arthur (01/11)
1. **Primeira tarefa da IA:** ainda por escolher; o Arthur pediu primeiro a lista do que a IA já faz no app (§1-bis).
2. **Chave e teto:** chave do **Gemini (Google)**; teto de **R$ 100 por mês** no máximo.
3. **Com quem fala:** **os dois**: leads de verdade no WhatsApp **e** apoio à equipe por dentro.
4. **Quem aprova:** depende da fase. Haverá uma **fase de treino** (a IA propõe e uma pessoa confirma) e, quando o Arthur ou o
   cliente avaliar que está bem treinada, **libera o modo automático**. O app já tem isso: o agente tem **Modo de operação**
   "Assistido" (prepara a sugestão na conversa e **só a aprovação humana autoriza o envio**) ou "Automático", e dá para pausar o
   automático sem perder a versão publicada.

**Decisões que saem daí:** (a) começar **todo agente em Assistido** e só mudar para Automático com o OK do Arthur, agente por agente
e cliente por cliente; (b) Gemini é um provedor que o app sabe usar (`Google (Gemini)`; a chave vem do Google AI Studio); a conferir na
sessão: se o seletor de modelo do agente oferece os modelos Gemini, qual modelo usar (barato e rápido para conversa) e o teto de
R$ 100/mês no painel de **Uso e orçamento** (`/app/ai/usage`, que já tem um cartão de orçamento); (c) o Arthur define o que "bem
treinada" significa (ex.: 50 respostas sugeridas, taxa de aprovação sem edição acima de X%), para a liberação não ser no olho.

## 1. O que existe hoje (levantado no código, `app/app/ai` e `lib/ai`)
- **Agentes** (`/app/ai/agents`): cada agente tem prompt do sistema, **modelo** (hoje: Claude Sonnet 4.6, Haiku 4.5 ou Opus 4.7, via
  AI Gateway), temperatura, tamanho máximo da resposta, janela de mensagens lidas, parâmetros de busca na base de
  conhecimento, e limiar de sentimento (passa para uma pessoa quando o cliente fica irritado). Canal de texto ou de **voz**.
- **Versões e publicação:** o agente tem rascunho e **versões publicadas**, com histórico, comparação entre versões e
  confirmação ao publicar; há um **painel de teste** (botão Testar) antes de publicar.
- **Capacidades (ferramentas):** o que o agente pode **fazer** no CRM (criar lead, mover card, anotar, pedir ajuda humana…),
  em pacotes. O primeiro agente da organização nasce com o pacote "Vender e mover o funil" ligado.
- **Proteções (guardrails):** bloquear certas frases de entrada ou saída, exigir que a resposta cite a base de conhecimento,
  respeitar uma janela de horário, e respeitar marcas do contato (forçar humano, bloqueado, VIP).
- **Bases de conhecimento** (`/app/ai/knowledge`): as fontes que o agente consulta (as ofertas publicadas já alimentam).
- **Roteadores** (`/app/ai/routers`): escolhem **qual agente** atende cada conversa.
- **Habilidades (skills), memória, casos, propostas:** habilidades reutilizáveis, memória da organização, casos de atendimento
  e propostas de mudança que a IA sugere e uma pessoa aprova.
- **Execuções** (`/app/ai/runs`) com o passo a passo de cada resposta, **uso e custo** (`/app/ai/usage`) e **credenciais**
  (`/app/ai/credentials`: a chave do provedor, por organização).
- **Follow-ups ligados a agente:** o agente "arma" os follow-ups que podem disparar sozinhos quando o fluxo usa IA.

## 1-bis. O que a IA já faz no app hoje (30 pontos de IA registrados em `lib/ai/pontos/registro.ts`)
Agrupados pelo papel que cumprem. "Fala com o cliente" = o texto chega ao lead; o resto trabalha por baixo.

**Atender o cliente (fala com o cliente)**
- Responder o cliente na conversa, usando a base de conhecimento (agente de atendimento).
- **Trabalhar o funil:** criar lead, mover o card de etapa, anotar e pedir ajuda humana durante a conversa.
- **Abordar quem preencheu o formulário** (mensagem escrita pela IA numa automação).
- **Sugerir resposta ao atendente** (a IA propõe e a pessoa envia: é o modo Assistido).

**Entender a conversa (por baixo)**
- Escolher **qual agente** atende cada conversa (roteador).
- Identificar a **etapa do lead** pela conversa; ler o **valor da venda** na conversa.
- Medir o **clima** (sentimento) e passar para uma pessoa quando o cliente fica irritado.
- Ler a resposta a um **follow-up** e escolher a **hora** do próximo.
- Conversar sobre um **caso** de atendimento com a equipe.

**Proteger a operação**
- Barrar **tentativa de manipulação** (jailbreak), impedir **promessa que não se cumpre** e conferir **afirmações de fato**
  na resposta, mais as proteções que a pessoa configura (frases proibidas, horário, marcas do contato).

**Lembrar e buscar**
- Resumir conversas longas, **guardar o combinado**, **fechar o atendimento**, indexar e **buscar no material** da empresa.

**Ver e ouvir**
- **Transcrever o áudio** do cliente e **ler a imagem** que ele manda.

**Melhorar e testar**
- **Ensaiar** o agente antes de publicar, avaliar o próprio atendimento e **extrair a lição** (o agente sugere melhorias
  que uma pessoa aprova), testar a conexão com o provedor.

**Propostas comerciais**
- Ajustar proposta por instrução, preencher proposta com a conversa e transformar uma proposta da empresa em modelo.

**Ferramentas do agente no CRM** (o que ele pode *fazer*, em 6 pacotes que se ligam por agente): Atender e responder · Vender e
mover o funil · Não perder o cliente (retornos e quem esfriou) · Passar para um humano · Organizar a operação (marcadores,
etapas, avisos, distribuição) · Aprender e evoluir. Cada ferramenta é marcada como "só consulta", "altera dados" ou "efeito que
não dá para desfazer".

**O que a IA ainda NÃO faz sozinha neste app (a avaliar):** prospectar leads novos; montar o cronograma e a estratégia do
cliente; escrever os relatórios semanais; analisar campanhas e sugerir otimização (hoje a Última análise e a Última
otimização são notas escritas por pessoas); preencher a autoavaliação da semana.

## 2. Roteiro da sessão de revisão (com o Arthur)
1. **Para que a M1 quer IA?** (atender o primeiro contato do lead, qualificar, agendar reunião, confirmar presença, responder
   dúvida de cliente, reativar lead frio, apoiar a equipe só nos bastidores?) e **para quem** (a M1 e/ou os clientes dela).
2. **Quais agentes** isso gera e o papel de cada um (nome, tom de voz, o que pode e o que nunca pode fazer).
3. **Chave de IA e custo:** qual provedor/chave, limite de gasto por organização, modelo padrão (rápido e barato × mais capaz).
4. **Segurança:** quando passa para humano, quais frases bloquear, horário de atuação, o que a IA nunca promete (preço, prazo).
5. **Base de conhecimento:** o que o agente pode citar (ofertas, FAQ, política). Hoje: as ofertas publicadas.
6. **Teste:** montar o primeiro agente de rascunho e testar no painel, sem publicar. Só publica quando o Arthur aprovar.
7. **Ligação com as automações:** quais follow-ups realmente precisam de IA e quais rodam só com texto fixo (sem agente).

## 3. Perguntas para o Arthur começar (respondidas na §0; as próximas estão no chat)
1. Qual a **primeira tarefa** que você quer que a IA faça sozinha, para a M1 ou para um cliente?
2. Você já tem uma **chave de IA** (Anthropic, OpenAI ou outra) e um teto de gasto em mente?
3. A IA vai **falar com leads de verdade** (WhatsApp) ou só ajudar a equipe por dentro?
4. Quem aprova o que a IA diz: ela responde sozinha, ou propõe e uma pessoa confirma?
