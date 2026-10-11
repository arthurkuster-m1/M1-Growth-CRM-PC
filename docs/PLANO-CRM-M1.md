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
