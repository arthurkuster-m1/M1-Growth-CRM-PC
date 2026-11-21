# Plano — GUIA do M1 (o "cônsul" de cada empresa)

Rascunho de 20/11/2026, **aguardando as decisões do Arthur** (seção 13). Nada foi construído ainda.

## 1. A ideia em uma frase
Uma aba **Guia** em cada empresa, logo no menu lateral, que **conhece o projeto de marketing inteiro**: diz o que já está pronto, o que falta, qual é o próximo passo, leva a pessoa até a tela certa (ou deixa fazer ali mesmo) e, depois que as campanhas rodam, olha os resultados e sugere o que fazer (refazer concorrência, novos criativos…). Não é só onboarding: é o **mapa e o GPS** do cliente durante toda a vida dele.

## 2. O princípio que decide tudo: IA é o último andar, não o alicerce
O Guia precisa funcionar **sem IA** e de graça. A IA entra como camada opcional por cima. Quatro camadas:

| # | Camada | Usa IA? | O que faz |
|---|---|---|---|
| 1 | **Mapa do processo** (catálogo) | Não | A lista de tudo que existe no marketing de uma empresa: o que é essencial, o que é opcional, o que só vale para certos nichos, em que ordem, como saber se já está feito, onde se faz. É código + dados, escrito por nós. |
| 2 | **Diagnóstico por regras** | Não | Lê o banco e responde, para cada passo: feito / em andamento / falta / desatualizado / não se aplica. Calcula a **prontidão (%)** e ordena os próximos passos. |
| 3 | **Ideias por regras** (resultados → o que fazer) | Não | Regras do tipo "CPL 40% acima da meta há 7 dias → criar criativos novos". Cada ideia traz a **evidência** (os números) e um botão de ação. |
| 4 | **Consultor com IA** | Sim, opcional | Três modos: (a) desligado; (b) **IA no app** (Gemini/Claude pela API); (c) **IA na sua conta**: o app gera o **Dossiê** + o prompt pronto, você cola na sua IA, volta e cola o resultado. |

As camadas 1–3 resolvem ~80% do valor. A 4 pega o que regra não pega: redigir estratégia, interpretar contexto, responder perguntas.

## 3. O que já existe e vamos reaproveitar (não reinventar)
- **Estratégia** (`lib/marketing/modulos.ts`): 3 fases e ~12 módulos (funil, ZMOT, marca, persona, concorrência, planejamento, ofertas, lead magnets…). O "feito/falta" de cada um vem de `marketing_pages` (rascunho/publicado). **Esta já é a espinha do Mapa.**
- **Prompts do método** (`docs/metodo-m1-referencia/`: persona, concorrente, planejamento, kick-off) → viram o campo `prompt` de cada passo no modo "minha conta".
- **Formato de texto estruturado** (`docs/GUIA-TEXTO-ESTRUTURADO-ESTRATEGIA.md`, `lib/marketing/texto-estruturado.ts`) e o script `marketing-preencher` → o jeito de **colar o resultado da IA e virar rascunho de página**.
- **"O que fazer agora" das campanhas** (`alertasDaCampanha` em `lib/marketing/campanhas-resumo.ts`: orçamento estourado, testar criativos, CPL acima da meta, aumentar orçamento…) → **semente do motor de ideias**; vira a primeira leva de regras.
- **Tarefas e Cronograma** (`crm_tasks.cronograma_item_id`, criação rápida) → o plano do cliente **vira tarefas de verdade**, sem lista paralela.
- **Camada de IA** (`lib/ai/gateway.ts`, credenciais por empresa, `lib/ai/pontos/registro.ts`, uso/orçamento em `/app/ai/usage`, teto de R$ 100/mês com Gemini já decidido em `PLANO-AGENTES-M1.md`) → o Consultor entra como **mais um ponto de IA** registrado, com chave, modelo e custo já visíveis.
- **Notificações por pessoa** (`aviso-pessoal.ts`/`montar-avisos.ts`) → avisar "passo essencial atrasado" / "nova ideia".
- **Onboarding novo** (`PLANO-ONBOARDING-NOVO-M1.md`): hoje curto e neutro. O botão final "Por onde começar" passa a levar ao Guia.
- **Modo agência** (`lib/agencia/*`): a agência vê as empresas dos clientes; o Guia nasce pensado para ela.

## 4. O Mapa do processo (catálogo) — o coração
Cada **passo** do catálogo tem:
- `chave`, `fase`, nome e **"por que importa"** (1 frase para o cliente);
- **classificação**: `essencial` · `recomendado` · `opcional` · `por nicho` (vale só para alguns perfis);
- **dependências** ("Criar LP" só depois de "Oferta");
- **detector**: como o sistema sabe que está feito (ex.: existe página publicada do módulo "análise de concorrência");
- **ação**: `link` (abre a tela), `gaveta` (faz ali mesmo) ou `assistente` (passo a passo curto);
- **guia curto**: o passo a passo em linguagem simples;
- **prompt pronto** (se o passo se beneficia de IA) e o formato esperado do resultado;
- **validade**: passos que vencem (`revisar_a_cada_dias`): concorrência a cada 6 meses, criativos a cada ~30 dias etc. → ficam "desatualizados".

### Perfil do cliente (para saber "o que não vale")
Na primeira vez o Guia pergunta o básico e grava um **perfil**: nicho (clínica, serviço/agência, loja, infoproduto, imobiliária, B2B…), **como vende** (agendamento/reunião, venda direta no WhatsApp, e-commerce, checkout), objetivo, ticket médio, tem site/LP/Instagram? A matriz **passo × perfil** decide o que aparece como essencial, opcional ou escondido. É daqui que sai "o que é vário, o que não vale, o que precisa ter".

### Esqueleto inicial (~30 passos; a gente refina juntos na G0)
0. **Cadastros essenciais:** dados da empresa (nome, nicho, site, Instagram, telefone, fuso) · marca (logo/cor) · equipe e papéis · perfil do Guia.
1. **Diagnóstico:** mapeamento do funil atual (kick-off) · posicionamento/canais online · identidade da marca.
2. **Produto e oferta:** estudo de persona · análise de mercado · análise de concorrência · planejamento empresarial · produtos e ofertas · lead magnet *(por nicho)*.
3. **Captação:** landing page · site institucional *(por nicho)* · Meta Ads conectado + CAPI · formulário/webhook de leads chegando · WhatsApp conectado.
4. **Venda e atendimento:** funil do CRM com etapas · "próximo passo padrão" por etapa · **tipos de agendamento e disponibilidade** · anti no-show *(se vende por agendamento)* · respostas rápidas · automações básicas.
5. **Geração de demanda:** estratégia de marketing · criativos iniciais · 1ª campanha cadastrada (orçamento + meta de leads) · registro de vendas no CRM (fecha o laço da Meta).
6. **Operação semanal:** cronograma da semana · autoavaliação · dashboards conferidos.
7. **Otimização contínua (recorrentes):** refazer concorrência · renovar criativos · revisar oferta · revisar persona com dados reais · reunião de resultados do mês.

## 5. Diagnóstico por regras (sem IA)
Função **pura e testável**: `diagnosticar(perfil, sinais, catalogo) → estado de cada passo + próximos passos`.
- **Sinais** = consultas agregadas ao banco (sem dado pessoal de lead): páginas de marketing e status, ofertas, LPs, campanhas e dias, pipelines/etapas, tipos de agendamento, conexões (Meta, WhatsApp, Google Agenda), equipe, chave de IA. Os nomes exatos das tabelas se confirmam na G1.
- **Estados:** `feito` · `em andamento` · `falta` · `bloqueado` (dependência pendente) · `desatualizado` · `não se aplica` · `dispensado` (alguém escolheu pular, com motivo).
- **Ordem dos próximos passos:** dependências primeiro; depois essenciais; depois impacto. Mostra **no máximo 3–5 próximos**, não a lista inteira (informação com propósito).
- **Transparência:** cada passo mostra "como sei disso" e permite **marcar feito/dispensar à mão** (detector errado nunca trava ninguém).
- **Prontidão (%)** por fase e geral, com o que falta para subir.

## 6. O plano do cliente
Na página o Arthur **monta o plano da empresa**: escolhe passos do mapa (ou o Guia propõe o plano padrão do perfil), define **responsável** (agência/cliente/pessoa), **prazo** e ordem. Cada item pode **gerar tarefa em Tarefas** e entrar no **Cronograma** (mesmo vínculo `cronograma_item_id`). Concluir a tarefa atualiza o passo; o passo detectado como feito conclui a tarefa. Histórico do plano visível (o que mudou e quando).

## 7. Resultados → ideias do que fazer (o motor)
Regras com **gatilho + evidência + ação + prioridade + tempo de silêncio** (para não repetir). Primeira leva (várias já existem em `alertasDaCampanha`):

| Se… | Ideia | Ação no botão |
|---|---|---|
| CPL acima da meta há 7 dias | Criativos novos / revisar público | Criar tarefa + abrir Criativos |
| CTR baixo com impressões altas | Trocar gancho/criativo | Abrir criativos da campanha |
| Frequência alta | Renovar criativos ou ampliar público | Criar tarefa |
| Muitos leads, poucos agendamentos | Revisar abordagem e **tempo da 1ª resposta** | Abrir Inbox/Automações |
| Muitos agendamentos, no-show alto | Ligar anti no-show | Abrir configuração |
| Reunião feita, pouca venda | Revisar oferta/processo comercial/concorrência | Abrir Oferta/Concorrência |
| Concorrência analisada há +6 meses | Refazer a análise de concorrência | Abrir passo + prompt |
| Campanha com verba e **sem venda registrada** no CRM | Conferir registro de vendas/CAPI | Abrir Conexões |
| Campanha encerrada | Registrar **o que funcionou / não funcionou** | Abrir aprendizado |

**Laço que se fecha (Sistema Vivo, inv. 7):** ideia aceita → depois de N dias o sistema **mede de novo** (antes × depois) e pergunta "funcionou?". A resposta vira **aprendizado** (`o que fizemos · hipótese · resultado · veredito`) que alimenta o Dossiê e a taxa de acerto de cada regra (regra que erra muito é rebaixada/ajustada). **Teto de 5 ideias ativas** por empresa, para não virar ruído.

## 8. Fazer na própria página
Três níveis, do mais simples ao mais ambicioso (a gente avança por demanda):
1. **Link com retorno:** a tarefa "Configurar tipos de agendamento" abre a tela existente (`/app/settings/tenant/agenda`) com uma faixa "← Voltar ao Guia"; ao voltar, o diagnóstico recalcula sozinho.
2. **Gaveta:** a tela existente abre numa gaveta lateral dentro do Guia (mesmo componente, sem duplicar lógica). Começa pelas 3 configurações mais pedidas.
3. **Assistente:** passo a passo curto com perguntas simples que grava as configurações (ex.: "Que dias e horários você atende?" → cria tipos e disponibilidade).
Regra: **nunca duplicar a lógica da tela**: o Guia reaproveita os componentes e rotas já testados.

## 9. O Dossiê (o documento que a IA lê)
Gerado **por código, sem IA** — todo número é calculado, a IA só interpreta. Markdown, com botões **Copiar**, **Baixar .md** e **versões salvas**. Seções (em ordem de prioridade; há versão "completa" e "resumida" para caber em qualquer IA):
1. Instruções para a IA (papel, o que pedir de volta, formato da resposta).
2. Perfil da empresa e do negócio (nicho, como vende, objetivo, ticket).
3. Estado do Guia: prontidão, o que está feito/falta.
4. Estratégia: resumo das páginas publicadas (persona, concorrentes, posicionamento, oferta).
5. Ofertas e produtos.
6. Campanhas: período, investimento, leads, CPL, agendamentos, vendas, receita, comparativo com a meta.
7. Criativos e abordagens: o que rodou, o que performou melhor e pior.
8. Funil do CRM: conversão por etapa, tempo de resposta, no-show.
9. **Aprendizados** (funcionou / não funcionou) e ideias já tentadas.
10. Plano ativo e tarefas em aberto.
11. Pergunta atual (o que o Arthur quer decidir agora).

**Privacidade:** só dados agregados e de estratégia; **nunca nome/telefone/e-mail de lead**. Nomes de concorrentes e ofertas entram (é o próprio material de marketing); confirmar com o Arthur (seção 13).

**Modo "minha conta" (colar resultado):** cada passo tem **Copiar prompt** (prompt do passo + Dossiê). Depois um campo **Colar resultado**: o app lê (texto estruturado), mostra uma **prévia**, e só grava **como rascunho** depois do OK — de uma página de estratégia ou de ideias/tarefas do plano. Nada publica sozinho.

## 10. IA dentro do app (camada opcional)
- **Onde:** novo ponto no registro (`lib/ai/pontos/registro.ts`) → aparece em Provedores/Execuções/Uso, com modelo e chave por empresa e o **teto mensal já definido (R$ 100)**.
- **Tarefas:** (1) gerar ideias lendo o Dossiê; (2) rascunhar a página de um passo; (3) revisar o plano; (4) perguntas e respostas sobre o projeto (por último).
- **Regras:** sempre **rascunho**, nunca publica; cache por hash do Dossiê (não paga duas vezes pela mesma pergunta); registra execução e custo; mostra de onde veio cada número.
- **Gemini × Claude Sonnet:** recomendação para decidir com dados — usar **Gemini (modelo rápido/barato) para o dia a dia** (ideias, resumos, perguntas) e **Claude Sonnet só para redigir estratégia** (concorrência, planejamento, oferta), porque é onde a qualidade pesa. Um Dossiê completo deve ficar na casa de poucas dezenas de milhares de tokens, ou seja, **centavos de real por consulta**; **confirmar a tabela de preços do dia** antes de fixar. Como o modelo é escolhido por ponto de IA, trocar depois não exige código.

## 11. Telas e menu
- **`/app/guia`**: primeiro item do menu lateral, logo abaixo de Início, com contador de passos essenciais pendentes (padrão `contador` do menu). Empresa nova (prontidão baixa) abre o Guia como tela inicial.
- Abas: **Próximos passos** (topo, 3–5 cartões) · **Plano** · **Mapa completo** (por fase, com prontidão) · **Ideias** · **Aprendizados** · **Dossiê e IA**.
- **Cartão no Início**: "Próximos passos" (3 itens) levando ao Guia.
- Visual M1 (claro, arredondado, pouco texto) reaproveitando as peças de `components/marketing/campanhas/visual/Pecas.tsx` (cartão de passo com Completo / Falta preencher / Opcional, progresso).
- Quem vê: agência vê e edita tudo; **cliente (viewer)** vê só "Seu plano" simplificado (decisão 2).

## 12. Dados (resumo; só os necessários)
Tudo com `organization_id` + RLS; gravação por `manager` ou acima / modo suporte. Migrations a partir do próximo número livre depois da 0700 (arquivo em `supabase/migrations/` **e** apêndice idempotente no fim de `baseline.sql`; `revoke execute ... from public, anon` nas funções novas).
- `guia_perfil` — nicho, como vende, objetivo, ticket, tem site/LP/Instagram.
- `guia_passos` — **só as exceções** por empresa: passo dispensado/feito à mão, motivo, responsável, prazo, `task_id` (o resto é calculado; mesmo padrão do layout por pessoa, que guarda só desvios).
- `guia_ideias` — regra, evidência (jsonb), status (nova/aceita/dispensada/feita/medida), origem (regra/IA/manual), `medir_em`, resultado, `task_id`; única por empresa+regra+alvo+janela.
- `guia_aprendizados` — o que fizemos, hipótese, resultado, veredito.
- `guia_dossies` — versões geradas (markdown, hash, quem gerou) e `guia_importacoes` (resultados colados, prévia, status).
O **catálogo e as regras ficam em código** (`lib/guia/`), versionados no git e testados — não no banco — para a agência não quebrar o mapa sem querer. Limiares das regras editáveis por empresa (superfície de configuração).
Rotas mutantes: `requireRole` + `requireSupportWrite(` + Zod + `ok()/fail()` + `audit()` (ações novas em `lib/audit/actions.ts`). Sem HTTP em trigger. Textos em `t("português")` + espanhol. Porta em `lib/navigation/catalogo.ts`. Um **cron diário** (linha nova no crontab da VPS, `/api/v1/cron/guia`, que o Arthur coloca à mão) recalcula diagnóstico e ideias.

## 13. Fases (uma de cada vez, cada uma testável)
| Fase | O que entrega | Tem IA? | Esforço |
|---|---|---|---|
| **G0 — Fechar o mapa** | Arthur responde as decisões e revisamos juntos o esqueleto da seção 4 → `docs/MAPA-DO-PROCESSO-M1.md` aprovado (passos, essenciais por nicho, ordem, validade). **A parte mais valiosa; sem código.** | Não | 1 conversa |
| **G1 — Catálogo + diagnóstico** | `lib/guia/` (catálogo, coleta de sinais, `diagnosticar` pura) com testes e uma rota de leitura; tela provisória listando os estados. | Não | 1–2 sessões |
| **G2 — Tela Guia + menu** | `/app/guia`, porta no menu, cartão no Início, perfil do cliente, prontidão, "Próximos passos", dispensar/marcar feito, "criar tarefa". **Já é usável.** | Não | 1–2 sessões |
| **G3 — Fazer na página** | Link com retorno para todos os passos + gaveta nas 3 configurações mais usadas (começa por tipos de agendamento). Depois, uma por vez. | Não | 1 sessão cada |
| **G4 — Plano do cliente** | Montar plano, responsável/prazo, tarefas e Cronograma ligados, histórico. | Não | 1–2 sessões |
| **G5 — Dossiê + prompts + colar resultado** | Gerar/copiar/baixar Dossiê, prompt pronto por passo, importar resultado como rascunho com prévia. **Entrega o "modo minha conta".** | Na conta do Arthur | 2 sessões |
| **G6 — Ideias + aprendizados** | Motor de regras sobre campanhas/funil/agenda, cron diário, aceitar/dispensar, medição antes×depois, aprendizados. | Não | 2 sessões |
| **G7 — Consultor com IA no app** | Ponto de IA registrado, ideias e rascunhos pela API, teto de custo, cache, perguntas e respostas. | Sim | 1–2 sessões |

Ordem recomendada: **G0 → G1 → G2** (já tem produto) → **G5** (é o que o Arthur mais quer e custa zero de IA) → **G4 → G6 → G3 em paralelo, aos poucos → G7**. Dá para trocar; G3 e G6 são os mais flexíveis.

## 14. Checklist Sistema Vivo (para o Guia)
1. **Quem me alimenta:** sinais reais do banco (páginas de marketing, campanhas e dias, CRM, agenda, conexões) e as respostas humanas (perfil, aprendizados).
2. **Quem eu alimento:** Tarefas e Cronograma (plano), cartão no Início, sino/push, rascunhos de páginas da Estratégia (colar resultado).
3. **Registro que emito:** `audit()` por mutação; histórico de ideias e do plano; execuções de IA em `/app/ai/runs`.
4. **Onde apareço:** `/app/guia`, Início, sino.
5. **Porta:** menu lateral + `lib/navigation/catalogo.ts`.
6. **Anti-morte:** passo essencial atrasado e ideia sem resposta em 7 dias viram aviso e tarefa; nada fica parado sem dono.
7. **Configuração:** perfil e limiares das regras visíveis e editáveis; se não consegue ler um sinal, **mostra "não consegui verificar X"** (nunca finge que está feito).
8. **Continuidade IA↔humano:** a IA entrega rascunho com os números; o humano deixa resposta estruturada (veredito, aprendizado) que volta no Dossiê.
9. **Laço de retorno:** medição antes×depois de cada ideia; taxa de acerto por regra ajusta ou rebaixa a regra.
10. **Mapa:** atualizar `docs/architecture/*.json`, `CONTEXTO-M1.md` e `PLANO-M1.md` a cada fase.

## 15. Decisões para o Arthur (com minha recomendação)
1. **Nome no menu:** "Guia" (recomendo, curto e claro) · "Consultor" · "Rota".
2. **Quem vê:** começar **só a agência** (+ cartão simples "Seu plano" para o cliente depois) — recomendo.
3. **Posição:** logo abaixo de Início + cartão no Início + vira tela inicial de empresa nova — recomendo.
4. **IA:** construir G1–G6 **sem IA** e plugar a IA na G7 comparando Gemini × Sonnet com dados reais; a chave e o teto de R$ 100/mês já decididos valem — recomendo.
5. **Perfis de cliente da matriz:** quais nichos entram de cara? (proposta: clínica, serviço/agência, loja, infoproduto, imobiliária, B2B).
6. **Cadastros essenciais do cliente novo:** confirmar a lista da seção 4 (passo 0) e o que mais você exige.
7. **Seu mapa atual:** pode me mandar o checklist/Notion que a agência já usa (o "Profile do Cliente" e o que você faz na prática em cada fase)? Com isso eu monto o **primeiro rascunho do catálogo** para você corrigir.
8. **Dossiê:** pode ir nome de concorrentes, ofertas e números agregados para uma IA externa? (Lead individual **nunca** vai.)
9. **Cliente novo "pelado" sem agência:** o Guia vale também para o dono configurar sozinho, ou é ferramenta interna da agência por enquanto?

## 16. Riscos e como evitamos
- **Catálogo virar lista gigante:** começar com ~30 passos; só aparecem 3–5 próximos por vez.
- **Detector errar ("feito" falso):** sempre mostra "como sei" e permite marcar à mão; passo sem detector confiável nasce manual.
- **Ruído de ideias:** teto de 5 ativas, prioridade, tempo de silêncio por regra, evidência sempre visível.
- **IA inventar número:** o Dossiê traz números calculados por código; a IA só interpreta; tudo que ela devolve entra como rascunho.
- **Mexer em telas existentes:** o Guia só cria "em cima"; reaproveita componentes e rotas, não os altera.
- **Multi-tenant:** a empresa vem sempre da sessão, nunca do corpo; RLS em todas as tabelas novas.
