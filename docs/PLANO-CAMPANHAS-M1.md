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

## 7. Decisões do Arthur (11/10/2026)
1. **Imposto:** é o imposto da Meta sobre os anúncios; **variável por campanha** (no Google, por
   exemplo, não há). Campo `tax_pct`; líquido = bruto ÷ (1 + imposto).
2. **Cards:** galeria de cartões, como a dos Produtos.
3. **Campanhas do Meta atreladas:** escolher na própria aba de Campanhas — digitando o nome (quando
   ainda não aparecem) ou escolhendo, entre as campanhas do relatório do Meta, as que ainda não
   estão associadas a nenhuma campanha do Software.
4. **Outros canais:** métricas definidas com a ajuda do Claude (proposta no §8).
5. **Cliente vê as campanhas**, numa visão mais simples: campanhas ativas, dados essenciais, CPL e
   investimento, leads e vendas, LPs e criativos rodando e as otimizações feitas. Modelo da
   visualização a definir depois.
6. **Sem importar planilhas:** tudo nasce dentro do Software.
7. **Multi-tenant (frente 14):** ver todas as campanhas ativas **agrupadas por cliente**, como na
   tabela do Notion "M1 | Campanhas" (cliente, campanha, atual, análise, planejamento).

## 8. Métricas por canal (proposta)

Comum a todos: **investimento/custo → leads → reuniões → vendas → faturamento**.

| Canal | O que medir (por dia ou por semana) | Taxas |
|---|---|---|
| **Tráfego pago** | impressões, alcance, cliques no link, visitas à LP, leads, investido | CPM, CTR, CPC, connection rate, conversão da LP, CPL |
| **Prospecção fria** | abordagens, contatos (responderam), decisor, reuniões agendadas, reuniões feitas, vendas, valor total | contato/abordagem, decisor/contato, agendamento/decisor, comparecimento, fechamento, ticket médio, custo por reunião |
| **Social media** | publicações, alcance, impressões, engajamento (curtidas, comentários, salvamentos, compartilhamentos), visitas ao perfil, cliques no link, novos seguidores, leads (DM/cadastro), vendas, valor | engajamento %, custo por lead (se houver investimento) |
| **Indicações** | indicadores ativos, indicações recebidas, qualificadas, reuniões, vendas, valor, recompensa paga | indicação→venda, custo por venda |
| **Parcerias/influenciadores** | parceiros ativos, entregas (posts/ações), alcance, cliques/cupom usado, leads, vendas, valor, custo (fixo/comissão) | CPL, CAC, retorno sobre o custo |

Para canais sem API, o dado é **digitado por dia ou semana** na própria campanha (mesma tela de
"Diário"), com as taxas calculadas sozinhas.

## 9. Registro das sessões

### C1 — Cadastro e tabela (feita em 11/10/2026)
- **Banco (migration 0595):** `demand_campaigns` (canal, status, período ou contínua, funil do
  CRM, responsável, investimento bruto com período e imposto, metas de leads/CPL/vendas/
  faturamento, link da planilha, campanhas da plataforma atreladas) e `demand_campaign_notes`
  (diário de bordo: análise, feedback do cliente, planejamento e otimização). RLS: a empresa lê;
  manager+ escreve; o cliente lê só as "otimizações".
- **API:** `/api/v1/demand-campaigns` (lista, cria), `/[id]` (edita, apaga), `/[id]/notes`.
- **Tela:** Marketing › Geração de demanda › **Campanhas**: Tabela, Cards e Linha do tempo; busca,
  filtros, ordem, agrupamento, colunas que se mostram/escondem/reordenam, abas salvas, seleção e
  edição em massa, edição direto na linha. Página de cada campanha com cadastro, investimento
  (líquido calculado), metas, campanhas da plataforma e diário de bordo.
- **Próximo:** C2 (a planilha dentro do app: dia a dia, pace, funil completo, alertas). → feita, abaixo.

### Ajuste pedido (11/10/2026) — funis dentro da campanha, em formato visual
- Hoje os funis são criados em Geração de demanda (`GestaoDeFunis`). O Arthur quer que a criação
  e a edição do funil passem a ficar **em um bloco dentro da própria campanha**.
- Visual: **degraus em seta lado a lado** (referência: Isca → Entrada → Principal → Expansão →
  Recorrência), cada degrau com número, nome e descrição curta; fundo suave, seta apontando para
  a direita, responsivo (empilha no celular).
- Entra **depois de fechar o que já está programado (C2 em diante)**, junto da lista de ajustes
  que o Arthur vai passar. Não iniciar antes.

### C2 — Resumo e pace: a planilha dentro do app (feita em 11/10/2026)
- **Banco (migration 0597):** `demand_campaign_days` — uma linha por campanha e dia: impressões,
  alcance, cliques no link, visitas à LP, leads, investido e `extras` (métricas dos canais sem
  API); `source` = manual | csv | meta (a C3 grava `meta`). RLS: empresa lê, manager+ escreve.
- **Contas:** `lib/marketing/campanhas-resumo.ts` (puro, testado com os números do print da
  planilha): dias totais/passados/restantes, líquido, valor restante, meta e CPL necessário,
  leads por dia, meta para hoje, adiantado/atrasado, nova meta diária, meta/média/novo
  orçamento diário, CPM, CPC, CTR, custo por visita, connection rate, CPL, conversão da LP.
  Investimento "por dia/semana/mês" vira total pelo período (mês = 30 dias).
- **"O que fazer agora" (alertas automáticos, só tráfego pago):** CTR < 1% → testar criativos;
  connection rate < 70% → verificar conexão da LP; conversão da LP < 10% → verificar a LP;
  CPL > meta + 10% → CPL acima da meta; orçamento necessário > média + 10% → aumentar para R$ X;
  leads atrasados; orçamento estourado. **Limites são nossos (a planilha não os trazia) e
  ficam em `LIMITES`** — o Arthur confirma ou ajusta.
- **Dia a dia:** tabela editável na própria linha (grava ao sair), adicionar dia, apagar,
  **importar planilha CSV** (datas dd/mm/aaaa ou aaaa-mm-dd, "R$ 1.234,56", nomes de coluna
  sem acento) e baixar o modelo do canal. Canais sem API usam as métricas do §8 (prospecção:
  abordagens, contatos, decisor, reuniões, vendas, valor).
- **Tela:** a página da campanha agora abre com o Resumo (alertas, período/investimento, metas,
  pace, funil completo) e a tabela do Dia a dia; depois vêm Cadastro, Investimento, Metas,
  campanhas da plataforma e Diário de bordo.
- **Próximo:** C3 (Meta Ads automático por dia).

### C3 — Meta Ads automático (feita em 11/10/2026)
- **Banco (migration 0598):** `demand_campaigns` ganha `meta_account_id`, `meta_synced_at` e
  `meta_sync_error` (último sucesso e o código da última falha).
- **Escolher campanhas do Meta:** na página da campanha, bloco "Campanhas da plataforma" →
  **Escolher do Meta**: conta de anúncio, busca e filtro "Só as sem associação" (cada campanha diz
  se já está em outra campanha do Software). O nome digitado antes vira a campanha real (com id).
  Campanha atrelada só pelo nome não sincroniza (etiqueta "Só o nome").
- **Sincronização:** `lib/marketing/campanhas-meta-servidor.ts` +
  `lib/plataformas-de-anuncio/meta/insights-por-dia.ts` (insights com `time_increment=1`, filtro por
  id de campanha). Soma as campanhas atreladas por dia e grava em `demand_campaign_days`
  (`source='meta'`) trocando só impressões, alcance, cliques, visitas à LP, leads e investido —
  o que foi digitado em `extras` é preservado. Leads = "resultado" do Meta (ou, sem ele, as ações
  de cadastro). Período: do início da campanha (ou 30 dias, se sem início) até hoje.
- **Automático:** `GET /api/v1/cron/campanhas-meta` (de hora em hora; timer
  `m1-campanhas-meta.timer` na VPS; linha no scheduler self-host). Pega campanhas planejadas,
  ativas e pausadas com campanhas do Meta atreladas, a mais antiga primeiro (limite 40/rodada).
  Falha de uma não derruba as outras e fica em `meta_sync_error`. Botão **Sincronizar agora** na
  tela.
- **Próximo:** C4 (criativos e legendas) ou os ajustes que o Arthur vai passar.

### Regra dos dados (decisão do Arthur, 11/10/2026) — vale para tudo daqui para frente
- **Leads e resultados vêm SEMPRE do CRM**, nunca do Meta (variação falsa). Um lead que entra no
  funil da campanha, no CRM, conta nos dados da campanha, no dia em que entrou.
- **Do Meta entram só:** impressões, alcance, valor gasto, cliques no link e visualizações da
  página de destino.
- Implementação (migration 0599): `fn_demand_campaign_leads_by_day` conta contatos distintos por
  dia em `crm_leads` do funil da campanha, no fuso da organização; a leitura do dia a dia troca o
  campo `leads` por essa contagem (ignora o que estiver gravado) e a coluna é só leitura. A
  sincronização do Meta não pede nem grava leads. Duas campanhas que compartilham o mesmo funil
  contam os mesmos leads — a origem por campanha/criativo (CRM sessão 6) separa isso na C5.

### C4 — Criativos e legendas (feita em 11/10/2026)
- **Banco (migration 0600):** `demand_campaign_creatives` — nome, status (ativo/pausado/encerrado),
  formato, título, legenda, link da mídia, miniatura, LP de destino, observações, anúncio do Meta
  (`ad_id`, sem duplicar) e métricas de entrega (gasto, impressões, cliques, visitas à LP).
- **Importar do Meta:** traz os anúncios das campanhas atreladas (nome, título, legenda,
  miniatura, formato) e atualiza as métricas; a sincronização de hora em hora também atualiza as
  métricas dos criativos que já têm anúncio do Meta.
- **Tela:** bloco "Criativos e legendas" na página da campanha: cartões editáveis (legenda,
  título, mídia, LP, status, formato), filtro por status, métricas de entrega e taxas
  (CTR, CPC). Leads e CPL por criativo ficam para a C5 (origem do lead no CRM).
- **Próximo:** C5 (leads/vendas por campanha, LP e criativo — depende das sessões 6 e 7 do CRM).

### Reestruturação pedida pelo Arthur (11/10/2026) — feita em 4 entregas no mesmo dia
**Regras novas**
- **Funil é da campanha:** cada campanha tem um funil único, criado dentro dela (aba "Funil de
  conversão"). A tela de funis separada não existe mais; a página de Geração de demanda abre
  direto nas campanhas. Índice único `demand_campaigns_pipeline_uk` (migration 0601). Funis
  antigos sem campanha ("Pedidos", "Clientes Fechados") continuam existindo como legado — decidir
  com o Arthur se viram campanhas ou são arquivados.
- **Novo tipo "Aproveitamento de base":** a campanha dos clientes ativos (recompra, recorrência).
  Métricas do dia a dia: clientes contatados, respostas, propostas, vendas, valor total.
- **Estado atual** (em Tabela, Cards e Linha do tempo): `dd/mm | Investido: R$ … | N Leads | CPL R$ …`.
  Contínua = o mês corrente; com início e fim = do início até hoje/fim. Investido do dia a dia,
  leads do CRM (`fn_demand_campaigns_estado`).
- **Barra Filtrar/Ordenar/Agrupar compacta** (prop `compacta` do `BarraDeConsulta`), numa linha só.

**Subpáginas da campanha** (abas numeradas, `?aba=`): 01 Cadastro (cadastro + investimento +
metas + campanhas da plataforma) · 02 Visão geral (o que fazer agora, metas de leads, métricas
principais, pace, funil completo) · 03 Dia a dia (planilha + diário de bordo) · 04 Landing pages ·
05 Criativos · 06 Funil de conversão. **Campanhas de contato direto** (prospecção, indicações,
parcerias, aproveitamento de base) trocam 04 e 05 por **Abordagem**.
- **Criativos:** várias imagens por criativo (até 10, bucket de imagens do Marketing), duplicar
  com textos prontos, 5 títulos + 5 textos principais + 5 descrições (migration 0603), comparativo
  lado a lado.
- **Landing pages** (migration 0604): cadastro dos links, pré-visualização (iframe + abrir em nova
  aba) e comparativo — as métricas vêm dos criativos cujo link de destino é o da LP.
- **Abordagem** (migration 0602): meio, para quem, gancho, mensagem/roteiro, follow-up.
- **Funil de conversão:** desenho do fluxo em etapas (setas), configurar etapa por etapa (nome,
  papel, chance de fechamento, mover), "ao ganhar entra em…" e as configurações avançadas
  existentes.
- **Decisão minha a confirmar:** tráfego pago e social media têm LPs+criativos; as demais têm
  Abordagem.

### Ajustes do Arthur (11/10/2026, 2ª rodada) — migration 0605
- **Páginas opcionais por campanha:** o "+" ao lado das abas liga Landing pages, Criativos ou
  Abordagem em qualquer campanha; cada página opcional tem "Tirar esta página da campanha" (os dados
  ficam guardados). `demand_campaigns.optional_tabs` (nulo = padrão do tipo).
- **Funis legados:** "Pedidos" e "Clientes Fechados" apagados, leads para o funil "Base Padrão -
  Clientes" (padrão e funil de clientes da organização).
- **Pré-visualização das LPs:** a tela confere os cabeçalhos da página (X-Frame-Options e
  frame-ancestors do CSP) e, se bloquear, mostra o que adicionar no servidor com a origem exata do
  painel (nginx, Apache, Next.js, WordPress/Cloudflare).
- **Modelos de funil:** "Salvar como modelo" (a partir do funil da campanha) e "Usar um modelo"
  ao criar o funil de outra campanha — nasce com o nome da campanha. `demand_funnel_templates`.
- **Papéis de qualificação nas etapas:** "Lead MQL (qualificado)" e "Lead desqualificado" em "O que
  acontece nesta etapa". Entrar na etapa liga uma regra da Meta automática (`QualifiedLead` ou
  `DisqualifiedLead`, reaproveitando o motor de conversões por etapa) e, no MQL, marca o contato
  como MQL (`crm_stages.qualification`, triggers). `DisqualifiedLead` é evento personalizado: para
  a Meta otimizar com ele, criar a conversão personalizada correspondente no Gerenciador de
  Eventos.

### Ajustes do Arthur (11/10/2026, 3ª rodada) — migration 0606
- **Organização nova** nasce com o funil "Base Padrão - Clientes" (padrão e de clientes; Novo, Em
  andamento, Ganho, Perdido), no lugar de "Pedidos".
- **Tabela / Cards / Linha do tempo viraram o tipo da visualização salva** (como "Todas" e as abas
  das Tarefas): "Todas" é sempre tabela; cria-se uma aba e escolhe-se o tipo (`galeria` = Cards em
  `crm_saved_views.type`). Tirou o seletor do topo da tela.
- **Linha do tempo configurável:** "Dias na tela" (14 a 365) e "dividir colunas por Dias ou
  Semanas", guardado na aba (`config.linhaDoTempo`).
- **Sem zoom na área logada:** `viewport` com `maximumScale: 1` e `userScalable: false` em
  `app/app/layout.tsx` + `touch-action: pan-x pan-y` (iOS). Login e páginas públicas seguem com zoom.

### Ajustes do Arthur (11/10/2026, 4ª rodada)
- **Ordem das abas salvas** (campanhas): "Mover para a esquerda/direita" no "Configurar
  visualização"; a primeira aba é a que a página abre (`?v=todas` abre a "Todas"). A ordem é da
  empresa (`position`); a posição da "Todas" fica nas preferências da pessoa.
- **Cards seguem as propriedades da visualização** (as ligadas, na ordem), com título fixo.
- **Dia a dia com todos os dias:** com início e fim, todas as datas do período (hoje em
  destaque); contínua, o mês com navegação para os anteriores; "Só os dias com dados" para
  campanhas que rodam de vez em quando.
- **"+" das páginas da campanha:** popup ao lado do botão (adicionar e tirar páginas).
- **Rolagem lateral** da área logada travada (`overflow-x: clip`); causa: botões do funil que não
  quebravam linha.
