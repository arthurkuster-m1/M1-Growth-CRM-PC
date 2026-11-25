# M1 — Perfil do que a gente entrega (base para o plano da empresa)

Feito em 25/11/2026 lendo o código e os planos do projeto (`CONTEXTO-M1.md`, `docs/PLANO-*.md`, rotas do app).
Cada item tem um selo de honestidade:

- 🟢 **Pronto e no ar** — existe, funciona, dá para mostrar e vender.
- 🟡 **Pronto no código, falta testar/ligar** — dá para prometer só depois de validar com cliente real.
- 🔴 **Só plano** — não vender como se existisse.
- 🛠️ **Serviço seu (humano)** — não está dentro do software; é o que você e a equipe fazem.

---

## 1. A tese em uma frase

**A M1 não vende "um CRM". Vende o sistema inteiro de crescimento de uma empresa: atrai o cliente (tráfego pago, landing page, criativos, conteúdo), atende e fecha (WhatsApp, funil, agenda) e prova o retorno (dashboards de ROAS, CAC, faturamento) — tudo num lugar só, com a marca do cliente.**

O ponto que quase nenhuma agência tem: **o lead é rastreado do anúncio até o dinheiro recebido**. Você consegue dizer ao cliente "este anúncio custou R$ X e voltou R$ Y já pago". Esse é o diferencial para vender.

---

## 2. O que o SOFTWARE entrega (o produto)

### 2.1 Atrair — Geração de demanda e tráfego pago
| Entrega | Selo |
|---|---|
| Cadastro de **campanhas** (objetivo, meta de leads, meta de CPL, orçamento, período) com tabela, cards e linha do tempo | 🟢 |
| **Meta Ads conectado**: puxa gasto, impressões, cliques, leads por campanha, conjunto e anúncio | 🟢 |
| **Criativos** de cada campanha: legenda, até 5 títulos/textos/descrições (como o anúncio dinâmico), imagens, link do design (Canva), métricas por criativo | 🟢 |
| **Dia a dia automático** da campanha + análise, feedback do cliente, planejamento e otimizações (o "diário de bordo") | 🟢 |
| **Pace de gastos e de leads**, "CPL necessário", e alertas "O que fazer agora" (testar criativos, CPL acima da meta, aumentar orçamento) | 🟢 |
| **Status da campanha muda sozinho** após cada sincronização | 🟢 |
| **Rastreio da origem**: campanha → conjunto → anúncio → LP, com UTMs; botão de WhatsApp da LP rastreado por código `[ref:…]` sem script na página | 🟢 |
| **Meta CAPI** (devolve a venda para a Meta por telefone/e-mail em hash, evento por etapa do funil) — melhora a otimização do anúncio | 🟢 |
| Entrada de leads por **formulário/LP/n8n (webhook)** e **importação em massa** (planilha estilo Excel) | 🟢 |
| **Google Ads** (leitura/atribuição por `gclid`) | 🟡 base existe; dashboard D4 é pendência |
| **Lead Ads nativo** da Meta (formulário dentro do Facebook) | 🔴 hoje entra via n8n/webhook |
| Redes sociais (métricas, responder comentários/DM, programar posts) | 🔴 só plano (`PLANO-REDES-SOCIAIS-M1.md`) |

### 2.2 Estratégia — o "projeto de marketing" apresentável ao cliente
| Entrega | Selo |
|---|---|
| **Diagnóstico**: Mapeamento do funil, Posicionamento, Branding (modelos prontos) | 🟢 |
| **Produto e Oferta**: Estudo de persona, Análise de concorrência, Planejamento empresarial (com calculadora de meta) | 🟢 |
| **Produtos e ofertas** — única fonte de preço/produto, alimenta a IA | 🟢 |
| **Estratégias de marketing** (cada uma uma página) | 🟢 |
| Páginas em **blocos** (funil, SWOT, fluxo, métricas, canvas...), modo **Apresentar** em tela cheia, rascunho/publicado | 🟢 |
| **Link público sem login** (`/p/<token>`) com a marca do cliente — vira "entregável bonito" | 🟢 |
| **Cronograma**: metas com barra de progresso, fases, ações-chave, tarefas da semana (agência × cliente), histórico de adiamentos, link para o cliente | 🟢 |
| **Guia** (o "cônsul": diz o que falta no marketing da empresa, prontidão em %, próximos passos, ideias por regra) | 🟡 versão provisória em `/app/guia`; G2 em diante pendente |
| Prompts do método (persona, concorrente, planejamento, kick-off) | 🟢 como material de trabalho seu |

### 2.3 Converter — CRM, atendimento e agenda
| Entrega | Selo |
|---|---|
| **CRM**: Clientes, Oportunidades e Vendas; tabela estilo Notion + quadro Kanban + modo planilha; funis com cores e próximo passo padrão por etapa | 🟢 |
| **Ficha do lead** completa (visão geral, cadastro, atendimento, tarefas, vendas, funis, anotações, linha do tempo, LGPD) | 🟢 |
| **Venda = card do funil**: produtos, parcelas, status, responsável, origem | 🟢 |
| **Radar** de risco (crítico/em risco/em voo/em dia) | 🟢 |
| **Inbox de WhatsApp** (WAHA, uma instância por cliente) + respostas rápidas | 🟢 / 🟡 operar com cliente real ainda é o próximo teste |
| **Agenda** com Google (ida e volta), vários atendentes, só horários livres, **anti no-show** (lembretes + resposta do cliente) | 🟢 |
| **Prospecção ativa**: modo prospecção (ligar/WhatsApp com mensagem pronta), busca de empresas no Google Maps (Apify), cadência | 🟡 código pronto, aguardando teste |
| **Automações**: regras (20 gatilhos × 9 ações) + fluxos de follow-up em canvas, modelos prontos (primeiro contato, lead sem resposta, anti-no-show, pós-venda, reativar perdido, aniversário) | 🟢 |
| **Agentes de IA no WhatsApp** (atender, qualificar, mover funil, agendar, base de conhecimento, modo Assistido/Automático, teto de custo) | 🟡 existe completo, **desligado por decisão sua** — ainda não validado com cliente |
| **Propostas comerciais**, notificações por pessoa (push/sino), ligação (VoIP) | 🟢 / 🟡 |
| **Checkout/link de pagamento** (Pix) | 🔴 só plano |

### 2.4 Provar — dashboards e finanças
| Entrega | Selo |
|---|---|
| **Dashboard de Tráfego Pago**: investido, leads, CPL, vendas, CAC, ROAS, ticket médio, funil de mídia | 🟢 |
| **Dashboard Business**: faturamento recebido/a receber, LTV, produtos, fechamento do período | 🟢 |
| **Dashboard de Atendimento** (tempo de resposta, horários, equipe) | 🟢 |
| **Metas × realizado** nos cronogramas | 🟢 |
| **Finanças** da empresa (lançamentos, cartões, mês/ano, faturas, venda do CRM vira entrada) — só gerente | 🟢 (cobrança da Meta no cartão: 🟡 pausado) |

### 2.5 Operar para várias empresas (isso é o que te permite escalar)
| Entrega | Selo |
|---|---|
| **Multi-empresa** com isolamento de dados (cada cliente só vê o dele) | 🟢 |
| **Modo agência**: você enxerga todos os clientes (campanhas, cronograma, dashboards, tarefas) num lugar | 🟢 |
| **White-label**: nome, logo, cor, tema claro/escuro por empresa | 🟢 |
| **Equipe e papéis** (dono, gerente, membro, cliente só-leitura) | 🟢 |
| **Tarefas** (tabela, kanban, calendário, timeline, timer), **Anotações** estilo Notion | 🟢 |
| **LGPD**, auditoria, backup diário criptografado (restauração testada), monitoramento | 🟢 |
| Instalar **numa VPS própria** do cliente (kit de instalação herdado) | 🟡 existe, mas você mesma opera em hospedagem sua |

---

## 3. O que é SERVIÇO seu (o software não faz sozinho)

Isto é importante para o plano: **o app NÃO tem construtor de landing page, NÃO gera criativos e NÃO escreve conteúdo com IA.** Ele *organiza, rastreia e mede* esses entregáveis. Quem produz é você:

| Serviço | O que você entrega | Onde o software ajuda |
|---|---|---|
| 🛠️ **Landing pages** | Página de captura/VSL (fora do app, ex.: HTML estático/Cloudflare Pages) | Cadastra a LP na campanha; botão de WhatsApp rastreado; webhook recebe o lead; mede visita→lead→venda **por LP** |
| 🛠️ **Criativos** (imagem, vídeo, carrossel) | Peças e variações de texto | Guarda criativo, link do Canva, métricas e **vendas por criativo** — você prova qual criativo vende |
| 🛠️ **Conteúdo com IA** (posts, copy, roteiros) | Calendário e peças | Estratégia/Persona/Branding dão a base; prompts do método; redes sociais ainda 🔴 |
| 🛠️ **Gestão de tráfego pago** | Criar, otimizar e reportar campanhas | Tudo da seção 2.1 e 2.4 |
| 🛠️ **Estratégia e consultoria** | Diagnóstico, persona, oferta, funil | Seção 2.2: vira entregável apresentável com link para o cliente |
| 🛠️ **Implantação do CRM/IA no cliente** | Funil, follow-ups, agente, treinamento | Seção 2.3 + skill de cliente novo por nicho |

---

## 4. Os "pacotes" que dá para montar hoje

Sugestão de empacotamento a partir do que existe (preços ficam para você definir):

1. **Diagnóstico & Estratégia (porta de entrada)** — Mapeamento do funil + Persona + Concorrência + Oferta + Posicionamento/Branding, entregue como páginas publicadas com link. Pronto hoje (🟢).
2. **Tráfego + Captação (core)** — Estratégia + landing page + criativos + campanhas Meta, com CRM e rastreio até a venda, dashboards e cronograma mensal. Pronto hoje (🟢), é o pacote mais forte.
3. **Sistema de Vendas (CRM + atendimento)** — CRM, funil, WhatsApp, agenda com anti no-show, automações de follow-up. Pronto (🟢); piloto com cliente real é o que falta.
4. **Crescimento completo (recorrente)** — 2 + 3 + dashboards + cronograma + reunião mensal; modo agência para você operar.
5. **Add-ons** — Agente de IA no WhatsApp (🟡, liberar depois de validar), prospecção ativa (🟡), finanças (🟢).

---

## 5. O diferencial (o que você pode dizer no marketing)

- **Rastreio do anúncio ao dinheiro recebido** (ROAS e CAC reais, por campanha, anúncio, criativo e LP).
- **Meta CAPI**: a venda volta para a Meta e melhora a entrega do anúncio.
- **Tudo num só lugar**: estratégia, tráfego, CRM, WhatsApp, agenda, financeiro. Cliente não precisa de 6 ferramentas.
- **Transparência**: o cliente tem link com cronograma, resultados e estratégia na marca dele.
- **Método próprio** (Diagnóstico → Produto e Oferta → Geração de demanda) já embutido como telas.
- **Sistema vivo**: lead não morre sem resposta (follow-up, radar, próximo passo por etapa).
- **Dados do cliente em casa**: LGPD, backup, multi-empresa isolado.

---

## 6. Honestidade: o que ainda NÃO está validado

1. **Nenhum cliente pagante usa o sistema ainda.** A fase atual é operar a própria agência por 2 a 8 semanas até fechar o primeiro cliente usando o CRM (`PLANO-GO-LIVE-MVP-M1.md`).
2. **IA desligada** por decisão sua; agentes e prospecção com IA estão prontos no código, mas sem prova de resultado.
3. **Meta Ads / Google Agenda** ainda têm pendências de verificação (app Google em modo teste).
4. Vários itens listados como 🔴 (redes sociais, checkout, módulos por nicho) são **só plano**.
5. Há migrations "aplicar à mão na VPS" listadas no `CONTEXTO-M1.md` — confira antes de entregar a um cliente.

---

## 7. Perguntas que este perfil já ajuda a responder (para o seu plano)

- **Nicho:** o app já tem modelos de funil e follow-up pensados para clínica, serviços/agência, imobiliária, loja, curso/infoproduto e advocacia (skill `deskcomm-cliente-novo`). Os nichos onde o **WhatsApp + agenda + anti no-show** pesam mais (clínicas, estética, odonto, serviços com reunião) combinam melhor com o que está mais maduro.
- **Quem prospectar:** negócios que já investem em tráfego (ou querem) e vendem por WhatsApp/reunião, com ticket que paga o pacote.
- **Prova social:** o primeiro cliente piloto vale mais que qualquer estratégia; os dashboards geram o estudo de caso sozinhos.
