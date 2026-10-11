# PLANO DAS CAMPANHAS — M1 Growth CRM (frente 4, Geração de demanda)

> Rascunho de planejamento (11/10/2026), a validar com o Arthur. Linguagem simples. Base: a
> planilha de gestão de campanha que o Arthur usa hoje (1 por campanha) e o plano do CRM
> (`PLANO-CRM-M1.md`).

## 1. O que queremos

**Cada ação de vendas vira uma Campanha do Software**, num lugar só: objetivo, metas, período,
funil do CRM, investimento, resultados reais (leads, CPL, vendas, faturamento), pace de gastos e de
leads, criativos, LPs e o diário de análises. Tudo o que hoje vive numa planilha por campanha.

- Uma **Campanha do Software** = uma *ação de vendas*. Pode ter **várias campanhas do Meta**
  (ou de outras plataformas) ligadas ao mesmo objetivo.
- Canais: **Tráfego pago · Prospecção (outbound) · Social media · Indicações · Parcerias**.
- Visualizações: **Tabela · Cards · Timeline** (motor das Tarefas e dos Produtos).

## 2. Cruzamento com o que o CRM (fork) já entregou

| Item do plano do CRM | Situação |
|---|---|
| Sessão 1 — Lead único (1 contato = 1 lead, MQL, tag do funil) | ✅ no ar |
| Sessão 2 — Funis próprios (criados em Geração de demanda), "ao ganhar entra no funil", página Clientes (tabela + Kanban) | ✅ no ar |
| Sessão 3 — Tela Leads completa (abas por funil, calendário) | ◐ parcial (página Clientes) |
| Sessão 4 — Campos dinâmicos e ficha | ⏳ |
| Sessão 5 — Entrada automática por LP/formulário | ⏳ |
| Sessão 6 — Origem e rastreio (campanha, criativo, LP, UTMs) | ⏳ **necessária para "leads reais por campanha"** |
| Sessão 7 — Banco de vendas | ⏳ **necessária para "vendas e faturamento por campanha"** |
| Sessão 9 — Dashboards lendo as vendas | ⏳ |

Já existe no sistema (e vamos reaproveitar): painel Meta Ads (`/app/ads/meta`: campanhas e
insights da conta, credencial de leitura), `ad_hierarchy_cache` (nome de anúncio/conjunto/
campanha), `ad_tracking_links` (link rastreado do WhatsApp), `meta_ads_landing_pages` e cliques
com UTM. O nome `campaigns` no banco já é a **campanha de disparo** (WhatsApp em massa): a nova
entidade terá outro nome (ex.: `demand_campaigns`) para não misturar.

## 3. A planilha de hoje, desmontada

**Topo (cadastro):** data de início, data de fim, data de hoje, dias totais/passados/restantes,
investimento bruto, investimento líquido, valor restante.
**Resultado:** leads captados, valor investido, CPL.

**Metas:** meta de leads, leads captados, faltam, meta de CPL, **CPL necessário**, por dia,
meta para hoje, faltam, leads por dia, **nova meta diária**.
**Pace de gastos:** meta de orçamento diário, média atual, diferença, **novo orçamento diário**.
**Funil completo:** impressões, alcance, CPM, cliques no link, CPC, CTR, visitas à LP,
CP/ViewPage, connection rate, leads, CPL, taxa de conversão da LP.
**Observações/ações automáticas:** "Testar novos criativos", "Verificar conexão da LP", "Verificar
LP", "Aumentar orçamento para R$ X".
**Análise por campanha** (cada campanha do Meta): o mesmo funil e o investido.
**Aba diária:** dia, impressões, CPM, cliques, CTR, CPC, leads, CPL, investido + **análise,
feedback do cliente, planejamento, otimizações**.

### Fórmulas conferidas com o print (todas reproduzíveis)
- Dias totais = fim − início + 1 (30) · passados (11) · restantes (19).
- Investimento líquido = bruto ÷ 1,125 (600 → 533,33). *(a confirmar: é imposto de 12,5%?)*
- Valor restante = líquido − investido (533,33 − 138,52 = 394,81).
- Meta de CPL = líquido ÷ meta de leads (3,56) · **CPL necessário** = valor restante ÷ leads
  faltantes (394,81 ÷ 88 = 4,49).
- Leads por dia = meta ÷ dias totais (5) · meta para hoje = por dia × dias passados (55) ·
  faltam = meta para hoje − captados (−7 = adiantado) · **nova meta diária** = faltantes ÷ dias
  restantes (88 ÷ 19 ≈ 5).
- Meta de orçamento diário = líquido ÷ dias (17,78) · média atual = investido ÷ dias passados
  (12,59) · diferença (5,19) · **novo orçamento diário** = valor restante ÷ dias restantes (20,78).
- CPM, CPC, CTR, CPL, connection rate (visitas ÷ cliques), taxa de conversão da LP
  (leads ÷ visitas).

## 4. O modelo (conceitos)

**Campanha**
- Nome, canal, status (planejada · ativa · pausada · encerrada), responsável.
- Descrição, ideia, objetivo.
- Período (início e fim) ou **contínua**.
- **Funil do CRM** em que o lead entra.
- Investimento: valor **fixo** ou **por período**, bruto e líquido.
- **Metas** (leads, CPL, vendas, faturamento) — com a regra de período das metas do cronograma.
- Link da planilha antiga (opcional).

**Ligações** (o que torna a medição real)
- **Campanhas do Meta/Google** atreladas (id da plataforma) → investimento, impressões, cliques,
  visitas à LP e leads da plataforma, **por dia**.
- **LPs** e **criativos** (anúncios) da campanha → análise por LP e por criativo.
- **Leads do CRM** da campanha (pela origem/UTM — sessão 6 do CRM) → leads reais, taxa de
  conversão, vendas, faturamento (sessão 7).

**Dia da campanha** (a "aba diária"): impressões, alcance, cliques, visitas, leads, investido —
vindo da plataforma, ou digitado/importado para canais sem API.

**Diário de bordo**: entradas com data e tipo — **Análise · Feedback do cliente · Planejamento ·
Otimização** — ao longo da vida da campanha, com o texto e o autor.

**Criativos ativos**: nome, anúncio, link/imagem, **legenda**, status, métricas (CPL, CTR,
conversão, vendas, faturamento da origem).

## 5. As telas

1. **Geração de demanda › Campanhas** — tabela (motor), abas salvas, busca, filtros, agrupar por
   canal/status/funil; visualizações **Cards**, **Tabela** e **Timeline** (barras do início ao
   fim; contínuas com seta).
2. **Detalhe da campanha** — abas: **Resumo** (cabeçalho, metas, pace de gastos, pace de leads,
   funil completo, observações automáticas) · **Diário** (tabela por dia + notas) · **Criativos** ·
   **LPs e origens** · **Funil do lead** (o caminho no CRM) · **Diário de bordo**.
3. **Relatório do cliente** (mais adiante): link sem login e imagem, como o cronograma.

## 6. Sessões sugeridas

| # | Sessão | Entrega | Depende de |
|---|---|---|---|
| C1 | **Cadastro e tabela** | Criar campanhas, campos, status, período, funil, investimento, metas; Tabela, Cards e Timeline; busca e filtros | — |
| C2 | **Resumo e pace (a planilha dentro do app)** | Dia a dia digitado/importado por CSV; todas as fórmulas do §3; funil completo; observações automáticas | C1 |
| C3 | **Meta Ads automático** | Ligar campanhas do Meta; puxar insights por dia; conferir investimento com a planilha/plataforma | C1, painel Meta existente |
| C4 | **Diário de bordo, criativos e legendas** | Análises, feedback, planejamento e otimizações; criativos ativos | C1 |
| C5 | **Leads e vendas reais** | Leads/CPL reais, vendas e faturamento por campanha, LP e criativo | CRM 6 e 7 |
| C6 | **Metas automáticas e dashboards** | Meta com período lendo os números reais; mesmo cálculo nos dashboards | C5, frente 1 |
| C7 | **Relatório para o cliente** | Link sem login e imagem | C2+ |

C1 → C2 → C4 podem ir **antes** de o CRM terminar origem e vendas.

## 7. Decisões para o Arthur
1. Líquido = bruto ÷ 1,125 é imposto fixo de 12,5%? Deve ser configurável por campanha/empresa?
2. "Cards" = galeria de cartões ou quadro por status?
3. Como ligar campanhas do Meta: escolher da lista da conta conectada, ou por padrão no nome?
4. Prospecção, social media e indicações: quais métricas medir (envios, respostas, reuniões,
   publicações, alcance, indicações)?
5. O cliente vê as campanhas? Vê CPL e investimento, ou só leads e vendas?
6. Importar as planilhas atuais (a aba diária) por CSV na migração?
7. Uma agência com vários clientes: visão de todas as campanhas de todos os clientes (frente 14)?
