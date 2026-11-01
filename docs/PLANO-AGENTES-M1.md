# Revisão dos Agentes de IA do M1 (frente 11)

Criado em 01/11/2026. Objetivo: antes de publicar qualquer agente, **o Arthur entende o que cada peça faz** e decidimos juntos
quais agentes a M1 precisa, com que papel, limites e custo. Nada é publicado sem o OK dele. Esta revisão é pré-requisito dos
follow-ups que usam IA (`docs/PLANO-AUTOMACOES-M1.md`, fase 3).

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

## 2. Roteiro da sessão de revisão (com o Arthur)
1. **Para que a M1 quer IA?** (atender o primeiro contato do lead, qualificar, agendar reunião, confirmar presença, responder
   dúvida de cliente, reativar lead frio, apoiar a equipe só nos bastidores?) e **para quem** (a M1 e/ou os clientes dela).
2. **Quais agentes** isso gera e o papel de cada um (nome, tom de voz, o que pode e o que nunca pode fazer).
3. **Chave de IA e custo:** qual provedor/chave, limite de gasto por organização, modelo padrão (rápido e barato × mais capaz).
4. **Segurança:** quando passa para humano, quais frases bloquear, horário de atuação, o que a IA nunca promete (preço, prazo).
5. **Base de conhecimento:** o que o agente pode citar (ofertas, FAQ, política). Hoje: as ofertas publicadas.
6. **Teste:** montar o primeiro agente de rascunho e testar no painel, sem publicar. Só publica quando o Arthur aprovar.
7. **Ligação com as automações:** quais follow-ups realmente precisam de IA e quais rodam só com texto fixo (sem agente).

## 3. Perguntas para o Arthur começar
1. Qual a **primeira tarefa** que você quer que a IA faça sozinha, para a M1 ou para um cliente?
2. Você já tem uma **chave de IA** (Anthropic, OpenAI ou outra) e um teto de gasto em mente?
3. A IA vai **falar com leads de verdade** (WhatsApp) ou só ajudar a equipe por dentro?
4. Quem aprova o que a IA diz: ela responde sozinha, ou propõe e uma pessoa confirma?
