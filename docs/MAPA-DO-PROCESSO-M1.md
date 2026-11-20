# Mapa do processo de marketing — M1 (G0 aprovado em 20/11/2026; em código desde a G1)

> Insumo da fase **G0** do `docs/PLANO-GUIA-M1.md`. É a lista de tudo que existe no marketing de uma empresa e que o Guia vai acompanhar.
> **Rascunho feito só com o que já está no projeto** (módulos da Estratégia, telas do menu, prompts do método, planos). **Falta o Notion/checklist da agência**: onde o Arthur discordar, ele corrige aqui e esta página vira o catálogo (`lib/guia/catalogo.ts`) na G1.
> Todo "onde se faz" abaixo é uma tela que **já existe**; nomes de tabelas e sinais se confirmam na G1.

> **G1 (20/11/2026):** este mapa virou `lib/guia/catalogo.ts`. Ajustes feitos ao codificar: P00.3 (marca), P00.6, P26 e P48 começam **manuais** (ainda não há sinal confiável) e P46 também (a medição de tempo de resposta entra na G6); P55 abre a página de estratégias (a Prospecção não tem porta no menu); P00.3 abre "Sua empresa e marca". Decisão tomada ao codificar: o perfil "já tem oferta" (pergunta 5) existe e rebaixa Produto e Oferta para recomendado.

## 1. Como ler

**Classificação por perfil** (5 colunas: **CL** clínica · **SV** serviço/agência/B2B · **IM** imobiliária · **LJ** loja · **IN** infoproduto):
`E` essencial (o Guia cobra e bloqueia o que depende dele) · `R` recomendado (aparece, não bloqueia) · `O` opcional (só no Mapa completo) · `—` não se aplica (some).

**Como o sistema sabe que está feito** (confiança do detector):
🟢 automático e confiável · 🟡 automático parcial (o Guia mostra "como sei" e deixa corrigir) · 🔴 só manual (alguém marca).

**Vence**: passo que fica "desatualizado" depois de X dias e volta para a fila.

## 2. Perfil do cliente (o que o Guia pergunta uma vez)
O cadastro da empresa de hoje (`/app/settings/tenant`) só tem dados técnicos (nome, razão social, CNPJ, fuso, moeda…). **Nada de negócio**, então o Guia cria o perfil:

| Campo | Para quê |
|---|---|
| Nicho (CL/SV/IM/LJ/IN) | Decide a coluna da matriz |
| **Como vende:** (a) agendamento/reunião · (b) venda direta no WhatsApp · (c) checkout/e-commerce · (d) lançamento ou perpétuo | Liga/desliga passos de agenda, anti no-show, checkout |
| Objetivo principal (mais leads · leads melhores · mais vendas · reativar base) | Muda a ordem dos próximos passos |
| Ticket médio e faturamento mensal aproximado | Calibra metas e regras de resultado |
| Meta de leads do mês | Base da regra "leads atrasados" |
| Site, Instagram, Google Meu Negócio (links) | Detecta "tem canal"; alimenta Posicionamento |
| Tem LP? tem site? roda anúncios hoje? onde? | Pula passos que já existem fora do sistema |
| Principais concorrentes (até 3 nomes) | Pré-preenche a Análise de concorrência |

## 3. O mapa, por fase

### Fase 0 — Cadastros essenciais (pedidos já na entrada do cliente novo)
| ID | Passo (e por que importa) | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P00.1 | **Perfil do negócio** — sem ele o Guia não sabe o que é essencial | E E E E E | — | 🟢 `guia_perfil` preenchido | Guia (cartão inicial) | 12 meses |
| P00.2 | **Dados da empresa** (nome, fuso, moeda, CNPJ) | E E E E E | — | 🟢 campos de `organizations` | Sua empresa e marca | — |
| P00.3 | **Marca no sistema** (logo e cor) | R R R R R | — | 🟡 marca ≠ padrão | Sua empresa e marca / Marca | — |
| P00.4 | **Equipe e papéis** (quem é agência, quem é cliente) | E E E E E | — | 🟢 ≥2 pessoas ou dono definido | Equipe | — |
| P00.5 | **Acessos de anúncio** (Business Manager, conta de anúncio, Página, dataset/Pixel) | E E E E E | P00.1 | 🟡 Meta Ads conectado + dataset | Conexões › Meta Ads | — |
| P00.6 | **Canais online listados** (site, Instagram, Google…) | R R R R R | P00.1 | 🟡 links no perfil | Guia / Estratégia › Posicionamento | 12 meses |

### Fase 1 — Diagnóstico (Estratégia › Diagnóstico)
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P10 | **Kick-off / Mapeamento do funil atual** — de onde o cliente vem hoje, gargalo, SWOT | E E E E E | P00.1 | 🟢 página `mapeamento-do-funil` publicada | Estratégia › Mapeamento do funil | 12 meses |
| P11 | **Posicionamento e canais** (links e prints de tudo que é público) | R R R R R | P00.6 | 🟢 página `posicionamento-zmot` | Estratégia › Posicionamento | 12 meses |
| P12 | **Identidade da marca** (logo, cores, tom de voz, Why/How/What) | R R R R E | P10 | 🟢 página `identidade-da-marca` | Estratégia › Identidade da marca | — |

### Fase 2 — Produto e oferta (Estratégia › Produto e Oferta)
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P20 | **Análise de mercado** (pesquisa de mercado: tamanho, tendências, sazonalidade) | R R R R E | P10 | 🟢 subpágina `pesquisa-de-mercado` | Estratégia › Persona ou Concorrência | 12 meses |
| P21 | **Estudo de persona** (perfil, dores, desejos) + árvore de situações | E E E E E | P10 | 🟢 ≥1 subpágina `persona` publicada | Estratégia › Estudo de persona | 12 meses |
| P22 | **Análise de concorrência** (≥3 concorrentes) | E E E E E | P10 | 🟢 ≥3 subpáginas `concorrente` | Estratégia › Análise de concorrência | **6 meses** |
| P23 | **Planejamento empresarial** (metas, números, capacidade) | E E R R E | P10, P21 | 🟢 página `planejamento-empresarial` | Estratégia › Planejamento empresarial | 6 meses |
| P24 | **Produtos e ofertas** (a oferta clara, preço, garantia) | E E E E E | P21, P22 | 🟢 ≥1 oferta publicada (alimenta `catalog_products`) | Estratégia › Produtos e ofertas | 6 meses |
| P25 | **Arquitetura de premissas / posicionamento persuasivo** | R R R R E | P21, P24 | 🟢 subpágina `arquitetura-de-premissas` | Estratégia › Estudo de persona | 12 meses |
| P26 | **Lead magnet** (isca: diagnóstico, e-book, aula, simulador) | O R R R E | P24 | 🟡 oferta do tipo isca | Estratégia › Produtos e ofertas | — |

### Fase 3 — Captação (por onde o lead entra)
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P30 | **Landing page da oferta** | E E E R E | P24 | 🟡 LP cadastrada em campanha (`demand_campaign_landing_pages`) com URL | Campanhas › Cadastro | 6 meses |
| P31 | **Site institucional** | R R R E O | P12 | 🔴 link no perfil | fora do sistema | 12 meses |
| P32 | **Pixel + CAPI da Meta** funcionando | E E E E E | P00.5 | 🟢 dataset/token + evento por etapa ligados | Conexões › Meta Ads | — |
| P33 | **Lead chegando no CRM** (formulário/webhook/n8n) | E E E E E | P30 | 🟢 ≥1 lead com origem de campanha nos últimos 30 dias | Conexões › Webhooks / n8n | — |
| P34 | **WhatsApp conectado** | E E E E E | — | 🟢 canal WORKING | Conexões | — |
| P35 | **Google Meu Negócio / orgânico local** | R O R R — | P11 | 🔴 manual | fora do sistema | 12 meses |

### Fase 4 — Venda e atendimento (o que acontece depois do lead)
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P40 | **Funil do CRM** com etapas "ganhou" e "perdeu" | E E E E E | P10 | 🟢 funil ativo ≠ padrão arquivado | CRM › Funis | — |
| P41 | **Próximo passo padrão por etapa** | R R R R R | P40 | 🟢 ≥1 etapa com `proxima_acao_padrao` | CRM › etapa | — |
| P42 | **Tipos de agendamento e disponibilidade** *(só quem vende por agendamento)* | E E E — O | P40 | 🟢 ≥1 tipo + janelas da equipe | Configurações › Agenda · Equipe | — |
| P43 | **Google Agenda conectado** | R R R — O | P42 | 🟢 pessoa conectada | Agenda | — |
| P44 | **Anti no-show** (confirmações e lembretes) *(agendamento)* | E R R — — | P42 | 🟡 automação/follow-up de confirmação ativo | Automações | — |
| P45 | **Respostas rápidas** do atendimento | R R R R R | P34 | 🟢 ≥5 respostas | Respostas rápidas | — |
| P46 | **Resposta rápida ao lead** (1ª resposta em minutos: automação ou escala) | E E E E R | P33, P34 | 🟡 tempo de 1ª resposta medido | Automações / Distribuição | — |
| P47 | **Registro de vendas no CRM** (fecha o laço com a Meta) | E E E E E | P40 | 🟢 ≥1 venda registrada no período | CRM › Vendas | — |
| P48 | **Checkout / link de pagamento** *(venda direta online)* | — O — E E | P24 | 🟡 integração de checkout ativa | Conexões | — |

### Fase 5 — Geração de demanda
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P50 | **Estratégia de marketing** (qual canal, qual mensagem, qual meta) | E E E E E | P22, P24 | 🟢 ≥1 subpágina `estrategia` | Estratégia › Estratégias | 6 meses |
| P51 | **Criativos iniciais** (3–5 variações de gancho) | E E E E E | P50 | 🟢 ≥3 criativos | Campanhas › Criativos | **30 dias** |
| P52 | **Primeira campanha cadastrada** (orçamento, período, meta de leads, LP) | E E E E E | P30, P32, P51 | 🟢 campanha ativa com meta | Campanhas › Cadastro | — |
| P53 | **Campanha sincronizada com a Meta** (dados entrando) | E E E E E | P52, P00.5 | 🟢 dados dos últimos 3 dias | Campanhas | — |
| P54 | **Abordagem do lead** (a 1ª mensagem; áudio/texto) | R R R R R | P52 | 🟡 abordagem cadastrada na campanha | Campanhas › Abordagens | 90 dias |
| P55 | **Outbound / prospecção ativa** | O R O — — | P21 | 🔴 manual | Prospecção | — |
| P56 | **Programa de indicação / parcerias** | R O R O O | P24 | 🔴 manual | Estratégia | — |
| P57 | **Social media / conteúdo orgânico** | R R R R E | P12 | 🔴 manual | fora do sistema | — |

### Fase 6 — Operação semanal
| ID | Passo | CL SV IM LJ IN | Depende | Como o sistema sabe | Onde se faz | Vence |
|---|---|---|---|---|---|---|
| P60 | **Cronograma da semana** (agência × cliente) | E E E E E | P50 | 🟢 itens e tarefas da semana | Marketing › Cronograma | 7 dias |
| P61 | **Autoavaliação da semana** | R R R R R | P60 | 🟢 nota da semana gravada | Cronograma | 7 dias |
| P62 | **Dashboards conferidos** (tráfego, vendas, faturamento) | R R R R R | P53, P47 | 🔴 "marquei como visto" | Marketing › Dashboards | 30 dias |
| P63 | **Meta × realizado do mês** | R R R R R | P23, P53 | 🟡 metas do período preenchidas | Campanhas › Visão geral | 30 dias |

### Fase 7 — Otimização contínua (passos que **voltam sozinhos**)
Não são "feitos uma vez": são os passos acima que **vencem**, mais estes. O Guia reabre cada um quando o prazo passa **ou** quando um resultado indica (seção 4).
| ID | Passo recorrente | Reabre | Vira |
|---|---|---|---|
| P70 | Renovar criativos | a cada 30 dias, ou frequência alta, ou CTR/CPL ruim | P51 |
| P71 | Refazer a análise de concorrência | 6 meses, ou queda de conversão sem causa clara | P22 |
| P72 | Revisar oferta e preço | 6 meses, ou muita reunião e pouca venda | P24 |
| P73 | Revisar persona com dados reais (o que os leads de fato perguntam) | 12 meses, ou leads desqualificados | P21 |
| P74 | Reunião de resultados do mês + registrar aprendizados | todo mês e ao encerrar campanha | Aprendizados |
| P75 | Reativar base antiga (leads que sumiram) | trimestral | Follow-ups / Campanha de disparo |

## 4. Resultados → ideias (primeira leva de regras, para calibrar na G6)
Limiares são **chute inicial** — ajustados por empresa e pelo que a agência observar. Cada regra mostra a evidência e some se a causa passar.

| ID | Se… (janela) | Sugere | Reabre |
|---|---|---|---|
| R01 | CPL > meta ×1,3 por 7 dias | Criativos novos; revisar público | P70 |
| R02 | CTR < 0,8% com ≥5 mil impressões | Trocar gancho/criativo | P51 |
| R03 | Frequência > 3 (7 dias) | Renovar criativos ou ampliar público | P70 |
| R04 | Leads ok, agendamento < 15% | Revisar abordagem e tempo de 1ª resposta | P46, P54 |
| R05 | Agendou, no-show > 30% | Ligar/ajustar anti no-show | P44 |
| R06 | Reunião feita, venda < 15% | Revisar oferta, processo comercial e concorrência | P72, P71 |
| R07 | Verba gasta e **0 venda registrada** em 14 dias | Conferir registro de vendas e CAPI | P47, P32 |
| R08 | Leads de má qualidade (muita desqualificação) | Revisar persona e filtros do formulário | P73 |
| R09 | Orçamento estourado / ritmo atrasado | Ajustar orçamento (já existe em campanhas) | — |
| R10 | Campanha encerrada | Registrar o que funcionou / não funcionou | P74 |
| R11 | Sem lead novo há 7 dias | Conferir webhook/LP/conexão | P33 |
| R12 | Análise de concorrência > 6 meses | Refazer | P71 |

## 5. O que fica de fora de propósito (por enquanto)
Agentes de IA de atendimento (IA segue **pausada**, decisão do Arthur) · Finanças (módulo próprio) · LGPD e segurança (têm tela própria) · Redes sociais (plano próprio).

## 6. Para o Arthur corrigir (o que mais pesa)
1. **A lista está completa?** O que a agência faz hoje em cada cliente que não aparece aqui? (ex.: pesquisa de pós-venda, e-mail marketing, remarketing, Google Ads, grupos de WhatsApp, eventos)
2. **Essencial × recomendado:** concorda com os `E` por nicho? Os que mais duvido: P23 (planejamento) em loja, P31 (site) em clínica, P44 (anti no-show) fora da clínica, P12 (marca) como essencial só em infoproduto.
3. **Perfis:** juntei B2B em "Serviço/Agência" e deixei **advocacia** de fora. Concorda ou quer perfis separados?
4. **Validades:** 30 dias (criativos), 6 meses (concorrência, oferta, planejamento) e 12 meses (persona, marca) estão bons?
5. **Ordem:** o Guia deve sempre mandar Diagnóstico → Oferta → Captação → Venda → Campanha, ou há clientes que começam por **campanha primeiro** (já têm oferta pronta)? Se sim, um perfil "já tem oferta" libera P30–P53 sem exigir P20–P25.
6. **Fases 5–6 (outbound, indicação, social):** entram no Guia agora ou ficam só como lembretes manuais?
7. **Modelo de venda "só WhatsApp"** (sem agenda, sem checkout): há clientes assim? Hoje ele só tem P34/P46/P47 como essenciais da fase 4.
