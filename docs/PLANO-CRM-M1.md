# PLANO DO CRM — M1 Growth CRM (frente 8)

> Planejamento fechado com o Arthur em 11/10/2026. Escrito em linguagem simples, para servir de
> roteiro das sessões. Fonte de verdade do CRM; o plano geral (`PLANO-M1.md`) aponta para cá.

## 1. O que queremos (em uma frase)

**Um banco único de leads**, onde cada pessoa existe uma só vez (identificada pelo telefone),
pode estar em **vários funis ao mesmo tempo**, cada funil com **etapas próprias criadas dentro da
plataforma**, e onde cada **venda** é registrada num **banco de vendas separado** — que passa a ser
a fonte real do faturamento nos dashboards.

## 2. Regras de ouro (decididas)

1. **1 contato = 1 lead.** Quem fala no Inbox já vira lead no CRM, automaticamente, e nunca gera
   "outros leads". O telefone é a chave: duplicados são unificados e as informações se juntam.
2. **Funil é uma propriedade do lead, não um lead novo.** O lead tem *funil(is) atual(is)* e, dentro
   de cada funil, uma *etapa* daquele funil. Cada funil tem as suas etapas.
3. **Lead em vários funis** (cadastrou-se em várias campanhas): é o mesmo lead, com as tags
   automáticas dos dois funis e o histórico de todas as entradas.
4. **Ganhou uma venda?** O lead **permanece** no CRM: abre-se o cadastro da venda, a venda entra no
   histórico dele e ele pode entrar num novo funil (ex.: pós-venda).
5. **Campos flexíveis:** cada formulário traz os campos que quiser; nada de coluna fixa para todos.
   Campo novo pode ser criado na hora, e vale só para quem o tem.
6. **Vendas é outro banco.** Cliente, produtos/serviços, data, forma de pagamento, parcelas, valor
   pago e status (**Interesse · Comprometido · Pago**). O faturamento dos dashboards lê daqui.

## 3. O que já existe e vamos aproveitar

| Já existe no sistema | Como entra no plano |
|---|---|
| `contacts` com telefone único por empresa | Vira o **lead único** (telefone = chave) |
| `crm_leads` (contato × funil × etapa) | Vira a **participação do lead em um funil** (já guarda funil, etapa, valor, responsável, origem, tags e campos) |
| Funis e etapas (`crm_pipelines`, `crm_stages`) com campos por funil | Base dos funis criados na plataforma |
| Kanban, importações, captura por webhook/formulário (`webhook_sources`), link de anúncio para WhatsApp (`ad_tracking_links`), atribuição de anúncio | Base de importar, receber das LPs e rastrear origem |
| Motor de tabelas das Tarefas (filtros, abas salvas, colunas) | Reaproveitado para a **lista de leads** e para **vendas** |
| Campanhas de disparo e prospecção | Destino de "selecionar leads para campanha" |
| Tabela `sales` | Veio do projeto original (clínica, ligada a agendamento): **será substituída** por um banco de vendas próprio |

## 4. O modelo (conceitos)

**Lead** (1 por telefone)
- Quem é: nome, telefone, e-mail, Instagram, cidade… (dados básicos) + **campos personalizados**.
- Quando: **entrou em** · **primeiro atendimento/abordagem em** · última atividade.
- **MQL** (qualificado) sim/não, com quem/quando marcou.
- **Produtos/serviços de interesse** e **já comprados** (do catálogo/ofertas).
- **LTV atual** (soma do que já pagou) · **LTV previsto** (interesses + recorrências esperadas) ·
  **meses ativo** (desde a primeira compra paga, se segue ativo).
- **Tags** (inclusive as automáticas de funil e de origem).

**Participação em funil** (lead × funil)
- Funil, etapa, responsável, valor, previsão de fechamento, ganho/perdido e motivo.
- Um lead em N funis = N participações; a mesma pessoa, uma só ficha.

**Origem e rastreio** (1ª origem fica fixa; cada nova entrada registra a sua)
| Origem | O que registramos |
|---|---|
| Indicação | **Quem indicou** (aponta para outro lead/cliente) |
| Conteúdo | Rede social, formulário e, se possível, o post |
| Tráfego pago | Campanha, conjunto, criativo, LP, dispositivo e UTMs; para WhatsApp nativo, o link rastreado (estilo Tintim) |
| Extração de listas | Palavra-chave usada, CNAE, site/fornecedor da lista |
| Outbound / ligação / WhatsApp ativo | Campanha de prospecção e lista de origem |

**Venda** (banco separado)
- Cliente (lead), itens (produtos/serviços), data, forma de pagamento, nº de parcelas, valor pago,
  status (Interesse · Comprometido · Pago), origem (funil/campanha que fechou).
- Recorrência (assinaturas) para o LTV previsto e os "meses ativo".

## 5. As telas

1. **CRM › Leads** — uma página só, no visual da imagem de referência:
   faixa de números no topo (total de oportunidades, valor, taxa de conversão, ganhas, atividades
   atrasadas, sem contato há +7 dias), busca, filtros, exportar, importar, seleção em massa.
   - **Lista** com todos os leads (visão geral).
   - **Uma aba por funil** (visualização salva): mostra só as etapas daquele funil.
   - Cada funil em **Kanban**, **Lista** e **Calendário** (reuniões agendadas).
   - Ações em massa: editar campos, tags, funil/etapa, responsável, enviar para campanha.
2. **Ficha do lead** — dados, campos personalizados, funis, linha do tempo, produtos de
   interesse/comprados, LTV, vendas, origem de cada entrada.
3. **CRM › Vendas** — tabela (motor das Tarefas), abas salvas, filtros; o botão "Ganho" no CRM abre
   o cadastro de venda aqui.
4. **CRM › Funis** (configuração) — criar funis, etapas, cores, probabilidade, ganho/perdido,
   campos do funil, e o que acontece ao ganhar (ex.: entrar no funil de pós-venda).
5. **Importar / Exportar** — CSV com modelo (como fizemos com produtos), mapeamento de colunas,
   junção por telefone, atualização em massa por planilha.

## 6. As sessões (ordem recomendada)

**Andamento:** sessão 1 ✅ (11/10/2026) — lead único no ar · sessão 2 ✅ (11/10/2026) — funis na Geração de demanda e página Clientes · ajustes pós-sessão 2 ✅ (funil por linha, Primeira compra). **Próxima:** sessão 3 (abas salvas, calendário, ficha) ou 4 (campos dinâmicos) — o Arthur escolhe.

Cada sessão termina com algo que você consegue **testar no domínio**.

| # | Sessão | O que entrega | Você testa |
|---|---|---|---|
| 1 | **Lead único** | 1 contato = 1 lead; Inbox cria o lead sozinho; junção por telefone; datas (entrou, 1º atendimento); MQL; tags automáticas por funil | Mandar mensagem no Inbox e ver o lead aparecer; cadastrar o mesmo telefone duas vezes e ver 1 só |
| 2 | **Funis próprios** | Criar/editar funis e etapas na plataforma; funil atual do lead; lead em vários funis; regra "ao ganhar" | Criar o funil "Outbound" e o "Tráfego" com etapas diferentes |
| 3 | **Tela Leads** | Lista geral + aba por funil + Kanban + Calendário + faixa de números, no visual da referência | Navegar entre funis e visões |
| 4 | **Campos dinâmicos e ficha** | Campos personalizados por lead, criados na hora; ficha completa | Receber um formulário com campos novos e vê-los na ficha |
| 5 | **Entrada automática** | LPs/formulários criam/atualizam o lead (dedupe por telefone), com campos e UTMs | Enviar um formulário de teste de uma LP |
| 6 | **Origem e rastreio** | Indicação, conteúdo, tráfego, listas; link rastreado do WhatsApp | Ver a origem completa de cada lead |
| 7 | **Vendas** | Banco de vendas; "Ganho" abre a venda; Interesse/Comprometido/Pago; parcelas; LTV atual/previsto; meses ativo; produtos de interesse/comprados | Ganhar um lead e ver a venda e o LTV |
| 8 | **Importar, exportar, massa e campanhas** | Importar/exportar CSV, editar em massa, enviar leads para campanha de disparo | Importar uma lista e mandar 20 leads para uma campanha |
| 9 | **Ligação com dashboards** | Faturamento dos dashboards lendo do banco de Vendas | Conferir os números |

Ficam para depois (frentes próprias): disparos de CAPI, movimentação automática estilo Tintim,
prospecção por scraping.

## 7. Decisões que precisam do seu "ok" (com a minha recomendação)

1. **Como unificar o "lead único"?** Recomendo usar o contato como lead e manter a participação em
   funil como já está no banco — muda pouco do que já funciona (Inbox, automações, follow-up, IA).
2. **Lead sem telefone** (só e-mail ou Instagram): entra, mas só é unificado por e-mail; avisamos
   quando aparecer o telefone para juntar. Recomendo permitir.
3. **Mesmo lead entra de novo no mesmo funil:** recomendo **reabrir** a participação e registrar a
   nova entrada no histórico (sem criar linha nova).
4. **MQL:** começa manual + marcação automática por etapa/resposta de formulário; os critérios
   finos a gente define na sessão 1.
5. **LTV previsto:** recomendo = valor dos produtos em Interesse/Comprometido + recorrência dos
   serviços mensais por 12 meses. Ajustamos a fórmula depois com dados reais.
6. **Vendas:** recomendo criar o banco novo e **aposentar** a tabela `sales` herdada da clínica
   (hoje sem dados seus), em vez de adaptá-la.
7. **"Ao ganhar":** cada funil define para qual funil o lead vai (ou nenhum). Recomendo
   configurável por funil, começando com "pós-venda".
8. **Dados atuais de teste:** recomendo apagar os leads de teste antes da sessão 1, para começar
   limpo.

## 8. Riscos

- Mexer em lead alimenta Inbox, automações, follow-up, IA e webhooks → cada sessão roda os testes
  desses módulos antes de ir ao ar.
- Unir duplicados é irreversível → na sessão 1, backup e relatório antes de unir.
- Rastreio do WhatsApp nativo depende da API oficial do Meta; vamos validar com um anúncio real.

## 9. Registro das sessões

### Sessão 1 — Lead único (feita em 11/10/2026)
- **Já existia:** o Inbox já cria o lead sozinho (`garantirLeadDaConversa`) e o contato já é único
  por telefone. Os 3 leads de hoje (2 de WhatsApp real, 1 do próprio Arthur) vieram assim.
- **Novo (migration 0593):** índice único `uniq_crm_leads_open_contact_pipeline` (1 negócio aberto
  por contato em cada funil); `contacts.is_mql`/`mql_at`/`mql_by`; `contacts.first_approached_at`
  (trigger na 1ª mensagem de saída); trigger que carimba `Funil: <nome>` no contato.
- **Regra no código:** `createLeadHandler` recusa (409, na tela) ou reaproveita (formulário,
  automação, importação) quando o contato já está no funil; reaproveitar junta campos e tags e
  registra na linha do tempo.
- **Tela:** seção "Qualificação" no dossiê do lead (entrou em, primeira abordagem, MQL, funis).
- **Decisão 3 ajustada:** em vez de "reabrir" a participação, vale a regra: 1 aberta por funil; a
  encerrada fica no histórico e a retomada cria a nova ligada à anterior (já existia).
- **Leads de teste:** não apaguei — são conversas reais de WhatsApp (uma é o número do Arthur).

### Sessão 2 — Funis próprios e a página Clientes (feita em 11/10/2026)
- **Funis nascem em Marketing › Geração de demanda** (`GestaoDeFunis`): a agência cria o funil,
  edita as etapas (mesmo editor das configurações), escolhe "ao ganhar, entra em…" e arquiva.
- **Ao ganhar → novo funil (migration 0594):** `crm_pipelines.settings.ao_ganhar_funil_id` + trigger
  `fn_lead_ganhou_entra_no_funil` (vale para tela, agente e lote). Rota `PUT /pipelines/[id]/ao-ganhar`.
- **Página Clientes** (`/app/clientes`, `components/clientes/ClientesCRM.tsx`): seletor de funil
  ("Todos" = lista completa), alternância Tabela | Kanban, faixa de números, busca, filtros/ordem/
  agrupamento e colunas do motor das Tarefas. API `GET /api/v1/clientes?funil=`. Kanban reaproveita
  o quadro do funil. Edição na tabela: etapa (não-ganho/perdido) e MQL.
- **Menu:** "Clientes" entra no sidebar do CRM; Funis e Contatos passam ao hub.
- **Fica para as próximas:** novo lead / importar / exportar / edição em massa (sessão 8), campos
  dinâmicos e ficha (sessão 4), abas de visualizações salvas na tabela, calendário de reuniões.

### Ajustes depois da sessão 2 (11/10/2026)
- **Funis e Etapa, um por linha** (página Clientes, aba "Todos"): cada funil do lead numa linha e as
  duas colunas alinhadas ("Funil · Etapa"); funis já encerrados aparecem com o estado entre
  parênteses, ex.: "Pedidos - Novo lead (Ganho)". O bug: a coluna só lia negócios abertos.
- **Campo padrão "Primeira compra" (data):** na seção Qualificação do dossiê (editável, atendente
  em diante) e coluna/filtro em Clientes. Hoje manual; na sessão 7 (Vendas) passa a ser derivado da
  primeira venda paga.

### Pontos em aberto do CRM (perguntados ao Arthur, sem resposta ainda)
1. O funil herdado **"Pedidos"** (existe nas 3 empresas): renomear para um funil do Arthur
   (ex.: "Tráfego pago") ou apagar?
2. Para a sessão 3: o que ele sentiu falta na página Clientes depois de testar?
3. Leads de teste: os 3 atuais são conversas reais de WhatsApp (uma é o número do Arthur) — não
   foram apagados.
4. Vocabulário do funil: o texto "tabela ou Kanban" na página Clientes reprova 2 testes
   (`vocabulario-do-funil`); trocar "Kanban" por "Quadro" na próxima sessão do CRM.

### Mudança de regra (11/10/2026): funil pertence à campanha
- A criação de funis saiu de "Geração de demanda › Funis do cliente" (componente `GestaoDeFunis`,
  removido) e passou para **dentro de cada campanha** (aba "Funil de conversão"). Cada campanha
  tem um funil único; não existe funil sem campanha daqui para frente.
- Funis antigos sem campanha continuam no banco e na página Clientes (legado) — a decidir com o
  Arthur: virar campanha ou arquivar.
- Novo tipo de campanha "Aproveitamento de base" (clientes ativos: recompra/recorrência),
  que se encaixa com o "ao ganhar entra no funil" da sessão 2.

### Sessão 6 (origem e rastreio) — feita em 11/10/2026 (migrations 0607 e 0608)
- **Lead carrega a origem:** `crm_leads.demand_campaign_id`, `demand_landing_page_id` e
  `demand_creative_id`. Lead nascido no funil de uma campanha herda a campanha (trigger).
- **Resolvedor único** (`lib/marketing/origem-da-campanha.ts`, puro e testado): campanha dita pela
  fonte → anúncio (`ad_id` → criativo) → id da campanha do Meta (`utm_campaign`/`utm_id`/
  `campaign_id`) → nomes (campanha e anúncio) → endereço da página (LP). Sem chamar a Meta na
  ingestão (usa criativos importados, campanhas atreladas e o cache da hierarquia).
- **Portas:** (1) formulário de LP (webhook `/webhooks/in/[token]`): fonte pode ser ligada a uma
  campanha; UTMs e página casam LP/criativo; (2) anúncio que abre o WhatsApp (nascimento do lead
  da conversa); (3) Lead Ads da Meta: pelo formulário ligado, com `ad_id`/`campaign_id` no
  payload (integração nativa direta pede `leads_retrieval` e fica para depois); (4) prospecção
  ativa/manual/planilha: cair no funil da campanha basta.
- **Telas:** aba "Funil de conversão" da campanha ganhou "Como os leads chegam" (ligar
  formulários, modelo de UTM da Meta, instruções); página Clientes ganhou a coluna e o filtro
  "Campanha".
- **Contagem:** leads da campanha = quem tem a campanha gravada OU está no funil dela.
- **Sincronização do Meta** importa anúncios novos como criativos a cada 6 h.

### Receber lead já tratado (n8n / sistema próprio) — 12/10/2026
- A mesma URL de captação (`/api/v1/webhooks/in/<token>`, fonte criada em Webhooks) recebe JSON
  de qualquer formato. Agora o payload é **achatado**: objetos viram `pai_filho` (até 4 níveis),
  listas de texto viram "a, b", listas de objetos viram JSON curto; nome/telefone/e-mail são
  achados também dentro de `lead`, `contato`, `cliente`, `dados`…; UTM em objeto (`utm: {campaign}`)
  vira `utm_campaign`. Os campos desconhecidos viram informação do lead (custom_fields).
- Fonte ligada a uma campanha (aba Funil de conversão › Como os leads chegam): o lead nasce no
  funil da campanha com a origem. `external_id` evita duplicar em reenvio.

### Sessão 7 — Vendas (feita em 12–13/10/2026; migrations 0609, 0610, 0611)
- **Página Vendas** (`/app/vendas`, botão em Clientes): cada venda é do cliente (lead); não existe
  venda sem cliente. Várias vendas por cliente (assessoria de 6 meses = 6 transações/parcelas).
- **Venda = itens + parcelas.** `crm_sales` (venda), `crm_sale_items` (vários produtos numa
  compra) e `crm_sale_payments` (parcelas: vencimento, valor, recebida/prevista). O dinheiro só
  conta no mês em que cai. Status da venda: interesse → comprometida → concluída (todas as
  parcelas recebidas) / cancelada; derivado das parcelas por trigger.
- **Totais no cliente** (trigger): LTV atual (parcelas recebidas), LTV previsto (atual + a
  receber), valor em interesse, nº de vendas, primeira e última compra (`first_purchase_on` agora
  é derivada). Colunas LTV atual/previsto/Em interesse/Vendas na página Clientes.
- **Origem da venda:** o ÚLTIMO cadastro do cliente até a data da venda (funil, campanha, LP e
  criativo). Faturamento recebido/a receber, vendas e conversão lead→venda por campanha, criativo
  e LP aparecem em "De onde vieram os leads".
- **Lead entra na campanha com ticket → venda de INTERESSE automática** (campanha tem produto e
  ticket previsto). **Lead ganho → venda efetivada** (comprometida, "a detalhar") e o pop-up
  "Finalizar venda" (produtos, valor real, forma de pagamento, parcelas, recebidas) abre na
  página Clientes; se fechar, fica sinalizada em Vendas.
- **Recorrência:** venda marcada recorrente fica com `recurrence_active`; a rota
  `/api/v1/cron/vendas-recorrentes` (diária, 7h30 SP) gera a parcela do mês seguinte SEMPRE como
  prevista e abre avisos na Central (véspera/dia e dia seguinte): "esse lead pagou? houve
  negociação?". Em Vendas, o painel "Cobranças para confirmar" tem Pagou (com valor real), Adiar e
  Cancelar. Nada é dado como pago sozinho.
- **Para depois:** integração com Hotmart/plataformas (puxar vendas por API); contas a receber
  na gestão financeira (as parcelas previstas já são esse dado).
- **Formulário vence a conversa:** lead nascido da conversa é ATUALIZADO (respostas, UTMs,
  origem) pelo formulário e movido para o funil da campanha; formulário anterior de outra
  campanha cria novo cadastro (a venda segue o último).

### Sessão 8 — Um lead, vários funis, várias vendas (13/10/2026; migration 0614)
- **Vocabulário:** 1 pessoa = 1 lead = 1 ficha (`contacts`). Em cada funil ela tem uma **passagem**
  (`crm_leads`: etapa, responsável, campanha de origem, ganho/perdido) — na tela deixou de se
  chamar "negócio". O **dinheiro** mora só em `crm_sales` (interesse → comprometida → concluída /
  cancelada), várias por pessoa, cada uma lembrando o funil/campanha de onde veio.
- **Valor do card = soma das vendas** da passagem (migration 0614). Quem escreve `value_cents`
  (tela, API, importação, IA) grava na venda de interesse/comprometida; o campo guarda a soma. Lead
  que nasce com valor gera a venda de interesse. Valor digitado com a venda já concluída cria um novo
  interesse (não reescreve o que foi pago).
- **Propostas comerciais saíram do produto:** páginas, menu, seção na ficha, avisos, rotas de API e
  crons removidos. Ficou dormente (sem uso, tabelas vazias): `lib/propostas/**`, ferramentas MCP
  `crm_draft_proposal`/`crm_preparar_proposta` (capacidade `propostas`, desligada) e as tabelas
  `crm_proposals*`/`proposal_templates`. Limpeza física fica para uma etapa própria.
- **CRM (Clientes):** abas de visualização salvas (Tabela/Quadro), barra de funis com arrastar e
  arquivar (preferência pessoal), edição das células no lugar (nome, telefone, e-mail, tags, valor,
  responsável, campanha, origem, etapa, situação e funil). Cards de campanha editam status e metas.
- **Em aberto:** "Comandas" (`/app/comandas`, tabelas `sales`/`sale_items`, módulo Financeiro) é um
  terceiro conceito de venda — decidir se vira Vendas.

## Sessão 9 — Novo lead e Importar leads no CRM (/app/clientes)

- Dois botões ao lado de "Vendas →": **Novo lead** (ficha num popup: funil, etapa, contato,
  valor, previsão, origem, etiquetas, observações e os campos personalizados do funil) e
  **Importar leads** (arquivo CSV, modelo CSV/XLS, ou tabela para preencher/colar do Excel/Sheets).
- Os dois usam `POST /api/v1/leads/import`, agora também em JSON (`{pipeline_id, stage_id?, celulas}`):
  uma só regra de leitura (`lerLinhasDeLeads`) para arquivo e tabela. Colunas novas: **Etapa** (pelo
  nome), **Previsão de fechamento** e uma por **campo personalizado** do funil (pelo nome).
- Sem telefone, a pessoa é achada/criada pelo e-mail. Quem já existe no funil tem as informações
  juntadas (`quandoJaExiste: "reaproveitar"`).
- Vocabulário das colunas: `lib/leads/colunas-da-planilha.ts` (puro); tabela/modelos no navegador:
  `lib/leads/tabela-de-importacao.ts`.

## Sessão 10 — Ficha do Lead reorganizada (/app/contacts/[id])

Abas: **Visão geral · Cadastro · Atendimento e Tarefas · Vendas · Funis · Anotações · Linha do Tempo · LGPD**.

- **Cadastro** (da PESSOA; editar vale para todos os funis): contato, links, qualificação, origem,
  respostas do formulário (juntam os campos do contato e de cada funil; salvar grava em todos),
  rastreamento, datas e tags.
- **Atendimento e Tarefas**: responsável/etapa por funil + tabela das tarefas pendentes do contato
  (`GET /api/v1/tasks?contact_id=`).
- **Vendas**: LTV atual, LTV previsto, vendas e ticket médio no topo; tabela com status editável na
  linha e cadastro/edição pelo mesmo diálogo da tela Vendas.
- **Funis**: um cartão por funil, só com o que é da passagem (situação, datas, vendas do funil,
  origem: campanha/criativo/LP e conjunto).
- **Anotações**: `lead_notes` (a memória que o agente de IA também lê) —
  `GET/POST /api/v1/contacts/[id]/anotacoes`, `DELETE …/[noteId]`.
- **Linha do Tempo**: histórico unificado + botões para registrar ação à mão (ligação + resultado,
  mensagem enviada, remarcou…) — `POST /api/v1/contacts/[id]/atividades` (grava `note` no negócio
  mais recente do contato; vocabulário em `lib/leads/acoes-do-lead.ts`).
- Visual: barras coloridas nos tópicos e etiquetas com borda (`ChipDeEtiqueta contorno`).
- Fica para depois: campos próprios do funil (previsão de fechamento, descrição) editáveis no cartão
  do funil — hoje continuam no dossiê do card ("Abrir no funil").

### Sessão 10 (continuação) — Funis editáveis e ações com tag

- **Funis (ficha):** cada cartão edita etapa, situação (ganho/perdido), responsável, previsão de
  fechamento e descrição; lista e cria vendas do funil (`lead_id`); origem com "Sem campanha",
  "Base de clientes (funil padrão)" (`source = base_de_clientes`, sem LP/criativo/conjunto) e as
  campanhas. O link "Abrir no funil" saiu da ficha.
- **Linha do Tempo:** "Outra ação" exige título; cada ação pode somar uma tag com contador
  (`No Show` → `No Show: 2x`, `lib/leads/acoes-do-lead.ts`); o título da linha é o da ação
  (`payload.titulo`) e o resultado/comentário ficam embaixo (vazio se não houver).
- **Pendente (decisão de modelo):** o card do quadro do funil passar a ser a VENDA atrelada ao lead
  (e a previsão/descrição morarem na venda) — ver conversa com o Arthur antes de mexer no quadro.

### Sessão 10 (continuação 2) — Categorias de tag, origem em cascata, dia a dia automático

- **Categorias de tag** (`lib/tags/categorias.ts`, `GET/PUT /api/v1/tags/categorias`): cada categoria
  tem uma cor e a tag herda (a cor própria da tag vence). Padrão: Ação (No Show, Remarcou,
  Compareceu…), Tracking (Campanha/Ad/LP/Conjunto), Funil, Qualificação (MQL); a organização cria as
  suas. Ficha: chips arrastáveis (ordem), editar nome/categoria, ordenar por categoria, agrupar e
  filtrar. Settings › Tags: filtrar, ordenar e agrupar por categoria.
- **Tags automáticas** com inicial maiúscula (`Campanha: X`, `Ad: X`, `LP: X`, `Funil: X`, `MQL`) —
  `normalizarTag` preserva a caixa delas; migration 0623 ajusta as que já existem.
- **Primeira compra** = data da primeira parcela recebida (sinal conta); não se edita. Vendas do
  contato contam quando algo foi pago. Migration 0623 (`fn_crm_sales_refresh_contact`).
- **Origem em cascata** (ficha › Cadastro): campanha → conjunto → anúncio → LP do anúncio →
  posicionamento (`GET /api/v1/marketing/origem-opcoes`); ids por trás, nomes na tela.
- **Dia a dia** das campanhas: nada se digita. Meta = anúncio (Meta) + leads (CRM); demais canais =
  vendas pagas, ações registradas, leads e orçamento (`lib/marketing/dia-a-dia-automatico.ts`).
- **Venda**: status explícitos (Interesse/Comprometida/Concluída/Cancelada), responsável e campos do
  funil dentro do popup; Vendas da ficha: LTV em interesse, "Previsto", sem rolar a página inteira.
