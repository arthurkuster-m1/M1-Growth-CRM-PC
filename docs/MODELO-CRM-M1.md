# Modelo do CRM M1: Cliente × Oportunidade × Pagamento

Documento de planejamento (fork). Nada aqui foi aplicado no banco ainda.
Decisões tomadas com o Arthur; o que está marcado **[a confirmar]** ainda depende dele.

## 1. Princípios

1. **Uma pessoa = um Cliente = o lead.** Uma entidade só (`contacts`). Não existe "lead" separado de "cliente".
2. **O dinheiro mora na Oportunidade e no Pagamento.** Tudo que é número real (faturamento, vendas, CAC, ROAS, LTV por campanha, criativo e landing page) é calculado a partir de **Oportunidades e Pagamentos**. Os valores na ficha do Cliente (LTV, total pago etc.) são **resumos para ver no CRM**; nenhum dashboard, análise de criativo ou de landing page lê o valor do Cliente.
3. **Status de pessoa é derivado, nunca digitado.** O sistema calcula e explica o porquê (`motivo_do_estado`).
4. **Etapa do funil existe só na Oportunidade.** O funil não descreve a pessoa.
5. **Só é compra quando há dinheiro recebido**, mesmo que seja só um sinal. Fechar "de boca" não é compra.
6. **Funis viram status das oportunidades.** A pessoa pode ter várias oportunidades em funis diferentes ao mesmo tempo.

## 2. Cliente (pessoa)

### 2.1 Ciclo de vida (calculado)

| Status | Regra |
|---|---|
| **Novo lead** | Entrou, não tem oportunidade aberta e nunca pagou |
| **Em negociação** | Tem oportunidade aberta e nunca pagou |
| **Cliente ativo** | Tem pagamento **Pago** (ou assinatura ativa) dentro da janela de ativo de **algum produto** |
| **Ex-cliente** | Já pagou, e nenhum produto está dentro da janela (inclui assinatura cancelada) |
| **Em reativação** | Era Ex-cliente e abriu nova oportunidade. Volta a **Cliente ativo** quando pagar e então recebe a tag automática **Reativado** |
| **Nunca comprou (Não comprou)** | Nunca pagou e todas as oportunidades estão em *Não comprou* |
| **Nunca comprou (Desqualificado)** | Nunca pagou e todas as oportunidades estão em *Desqualificado* (mistura = Não comprou) |

Desempates:
- **Cliente ativo vence Em negociação:** ativo que abre nova oportunidade continua ativo; a ficha mostra o selo "N oportunidades abertas".
- **Em reativação** só existe para quem era Ex-cliente.
- Estados de privacidade (bloqueado, anonimizado, sem consentimento) são **marcas à parte**, não estados do ciclo.

### 2.2 Janela de ativo (por produto)

- Cada **produto** tem sua janela: `janela_ativo_meses` (agência 1 mês; dentista 12 meses).
- A pessoa é **Ativa** se **qualquer** produto dela estiver dentro da janela.
- Assinatura ativa (recorrência ativa) conta como ativa enquanto durar.
- Padrão da empresa quando o produto não define a janela.

### 2.3 Propriedades

Legenda: C = cadastrada, K = calculada, T = técnica.

| Propriedade | Tipo | Destino |
|---|---|---|
| `name`, `display_name` | C | Fica (nome + apelido) |
| `email`, `email_normalized` | C / T | Fica |
| `phone_number`, `wa_identity`, `wa_lid` | C / T | Fica (WhatsApp ocultos) |
| `cpf_encrypted`, `cpf_hash` | C | Fica (LGPD) |
| `birthdate`, `birthday_md` | C / K | Fica |
| `locale`, `avatar_*` | C | Fica |
| `source`, `source_metadata` | C | Fica: origem do lead |
| `tags`, `custom_fields` | C | Fica |
| `is_mql`, `mql_at`, `mql_by` | K (+manual) | Fica; passa a nascer da etapa do tipo "qualificada" |
| `first_approached_at`, `first_service_at`, `last_activity_at` | K | Fica |
| `first_purchase_on`, `last_purchase_on` | K | Fica |
| `ltv_cents`, `ltv_forecast_cents`, `interest_cents`, `sales_count` | K | Fica (só para ver no CRM) |
| `client_recognized_at`, `client_tag_by_system` | K | **Sai** (substituído por `ciclo_de_vida`) |
| `consent`, `is_blocked`, `blocked_*`, `is_anonymized`, `anonymized_at` | C | Fica |
| `force_human`, `ai_authorized_*` | C | Fica |
| `kind`, `is_personal`, `person_id`, `is_merged_into`, `merged_at` | T | Fica |
| `created_*`, `updated_at`, `phone_lookup_at` | T | Fica |
| **`ciclo_de_vida`** | K | **Novo** |
| **`motivo_do_estado`** | K | **Novo** |
| **`oportunidades_abertas`**, **`valor_em_aberto`**, **`proximo_vencimento`** | K | **Novo** |
| **`dono_da_pessoa`** (dono do relacionamento) | C | **Novo** (veja §6) |
| **`proxima_recompra_prevista`** | K | **Novo** |

## 3. Oportunidade (negócio = venda = oportunidade)

Hoje são duas tabelas espelhadas (`crm_leads` e `crm_sales`). O destino é **uma só**: Oportunidade. A "Venda" é a oportunidade que chegou em *Comprou*.

### 3.1 Etapas

Etapas do funil de cada campanha/funil + **3 fixas** em todo funil:

| Tipo da etapa | Exemplo | Efeito |
|---|---|---|
| **Aberta** | Novo, Prospecção, Aquecimento, Proposta | Conta como "em negociação" |
| **Qualificada (MQL)** | Reunião marcada, Respondeu | Dispara o evento MQL, uma vez |
| **Comprou** (fixa) | n/a | Só entra quando há **pagamento recebido** (veja §5) |
| **Não comprou** (fixa) | n/a | Pede motivo |
| **Desqualificado** (fixa) | n/a | Pede motivo; dispara exclusão no Meta |

`is_won` e `is_lost` de hoje são substituídos por **tipo da etapa**. `status` (open/won/lost) fica derivado.

### 3.2 Propriedades

| Propriedade | Tipo | Destino |
|---|---|---|
| `id`, `contact_id` | T | Fica |
| `nome` (hoje `title`/`name`) | C | Fica; padrão = produtos juntados |
| `descricao` | C | Fica |
| `pipeline_id`, `stage_id` | C | Fica |
| `status` | K (do tipo da etapa) | Fica derivado |
| `lost_reason`, `won_reason`, `lost_from_stage_id` | C | Fica; motivo obrigatório em Não comprou e Desqualificado |
| `stage_changed_at`, `closed_at` | K | Fica |
| `owner_user_id`, `owner_kind`, `owner_agent_id` | C | Fica (dono da oportunidade: quem fecha) |
| `expected_close_date` | C | Fica |
| `expected_on` | C | **Sai** (duplica a 1ª parcela e a previsão) |
| `source`, `demand_campaign_id`, conjunto, `demand_creative_id`, `demand_landing_page_id` | C | Fica; herda do lead e é editável |
| `value_cents` | K (dos itens) | Fica calculado |
| `amount_cents` | K | **Sai** (duplica `value_cents`) |
| `currency` | C | Fica |
| `product_name` | K | Fica derivado; itens (produto, quantidade, valor, `product_id`) ficam |
| `payment_method`, `installments` | C | Fica |
| `is_recurring`, `recurrence_active`, `recurrence_ahead` | C | Fica |
| `retomado_de_lead_id` | K | Fica |
| `venda_adicional` | T | **Sai** (duas oportunidades passam a ser normais) |
| `needs_details` | K | **Sai** (vira "sem próxima ação") |
| `reference`, `notes`, `tags`, `custom_fields` | C | Fica |
| **`pago`**, **`comprometido`**, **`a_receber`**, **`em_interesse`** | K | **Novo** (baldes de dinheiro) |
| **`proxima_acao`**, **`proxima_acao_em`** | C | **Novo** |
| **`probabilidade`** | K | Novo (vem da etapa: `win_probability`) |

### 3.3 Funis e etapas (`crm_pipelines`, `crm_stages`)

- Etapa ganha **`tipo`** (aberta / qualificada / comprou / nao_comprou / desqualificado).
- As 3 fixas são criadas automaticamente em todo funil e não podem ser excluídas nem renomeadas.
- Mantêm-se: `win_probability`, `color`, `position`, `requires_human`, `avisar_na_central`.
- Funil de pré-venda: **Novo → Prospecção → Aquecimento**, mais as 3 fixas.

## 4. Pagamento (parcela)

### 4.1 Os quatro baldes

"Possível venda" **não é status de parcela**: enquanto é só interesse, não existe parcela, existe o valor esperado da oportunidade.

| Balde (nome na tela) | Origem | Calculado como |
|---|---|---|
| **Possível venda (interesse)** | Valor da oportunidade aberta sem parcela | Soma do potencial das abertas |
| **Comprometido** | Parcela com status **Prevista** | Soma das previstas |
| **Pago** | Parcela com status **Paga** | Soma das pagas |
| **Cancelado** | Parcela com status **Cancelada** | Não entra em nenhum total |

- **Atrasada** é um selo derivado (prevista com vencimento passado), não um status.
- **Cancelar uma parcela reabre o valor como Interesse** na oportunidade. A parcela cancelada pode ser **excluída**.

### 4.2 Propriedades

| Propriedade | Destino |
|---|---|
| `number`, `due_on`, `amount_cents` | Fica |
| `status` (prevista/recebida/cancelada) | Fica; na tela: Comprometido / Pago / Cancelado |
| `paid_on` | Fica |
| `confirmed_at` | Fica; passa a guardar **quem** confirmou |
| `reminded_before_on`, `reminded_after_on` | Fica (técnica) |
| **`forma`** (PIX, cartão, boleto) | **Novo** (por parcela) |
| **`origem_do_pagamento`** (manual / integração) | **Novo** |
| **`id_externo`** | **Novo** (evita duplicidade na Hotmart/gateway) |

## 5. Regras de derivação

1. **Venda** = oportunidade com pelo menos 1 parcela **Paga**. Antes disso é só oportunidade (mesmo que "comprometida").
2. **Comprou** (etapa) nasce na **primeira parcela Paga**, mesmo que seja um sinal. Antes, a oportunidade fica em etapa aberta com parcelas **Previstas** (selo "comprometido").
3. **Faturamento** = soma das parcelas Pagas no período. **A receber** = soma das Previstas.
4. **LTV atual** (pessoa) = soma das Pagas. **LTV previsto** = Pagas + Previstas.
5. **Recorrência**: 1 oportunidade + parcelas mensais previstas (`recurrence_ahead`). Nunca vira Paga sozinha.
6. **Cliente ativo** = tem Paga (ou assinatura ativa) na janela do produto.
7. **Todo relatório de campanha, criativo, landing page e dashboard** agrega **Oportunidades e Pagamentos** pela origem da oportunidade.

## 6. Dono da pessoa × dono da oportunidade

- **Dono da pessoa:** quem cuida do relacionamento (hoje comercial; depois pós-venda, sucesso do cliente).
- **Dono da oportunidade:** quem fecha aquela negociação.
- Abre caminho para expandir do comercial para a **gestão de relacionamento pós-venda** (carteira por responsável, reativação, renovação).

## 7. Eventos para o Meta (Conversions API)

| Evento | Quando | Uso |
|---|---|---|
| **Lead** | Lead novo | Volume |
| **MQL** | Entra em etapa "qualificada" | Otimizar para qualidade; lookalike |
| **Desqualificado** | Vai para Desqualificado | Público de exclusão; sinal de qualidade |
| **Purchase** | Parcela **Paga**, com valor | Principal; cada mensalidade paga é um Purchase |
| **Subscribe** (opcional) | Assinatura ativada | Lookalike de assinantes |

Regras: `event_id` para deduplicação; e-mail e telefone com hash, `fbc`, `fbp`, `external_id`; só enviar com consentimento.
Uso: otimizar para MQL quando houver volume; lookalike de MQL e de compradores (por valor, usando LTV); excluir Desqualificados e Clientes ativos da aquisição. A Meta não tem "lookalike negativo".

## 8. Análise de criativos: taxa de desqualificação

Nova métrica **por criativo** (e por anúncio/conjunto/campanha/LP):

- **Taxa de desqualificação** = oportunidades *Desqualificado* ÷ leads do criativo.
- Mostrar junto: leads, MQL, taxa de MQL, vendas, CPL, **custo por MQL**, **custo por venda**.
- Onde aparece: **dashboards** (Tráfego Pago e Business) e **aba de criativos dentro das campanhas**.
- Leitura: taxa alta com CPL baixo = criativo atrai gente fora do perfil (barato e ruim).

## 9. Interface: página CRM

A página **Clientes** passa a se chamar **CRM**, com 3 visões:

| Visão | Conteúdo | Formatos |
|---|---|---|
| **Clientes** | Lista de pessoas, com ciclo de vida e resumos | Lista (e novas visões) |
| **Oportunidades** | Negócios por funil/campanha | Lista e **Kanban**, por funil/campanha |
| **Vendas** | Pagamentos e parcelas | Lista (Pago, Comprometido, Cancelado, Atrasado) |

Em todas: **filtros** e **criar novas visualizações** no estilo Notion (visão salva com nome, tipo, filtros, ordenação, agrupamento e colunas visíveis; pessoal ou compartilhada).

## 10. Histórico de estados (obrigatório)

Tabela de histórico: `entidade` (pessoa/oportunidade/pagamento), `id`, `de`, `para`, `quando`, `quem` (pessoa, IA ou sistema), `motivo`. Base para coorte, tempo por etapa e "voltou a ser cliente".

## 11. Plano de migração (ordem sugerida)

1. **Histórico** + tipos de etapa + 3 etapas fixas em todo funil (aditivo).
2. **Ciclo de vida** calculado na pessoa + janela por produto + dono da pessoa (aditivo).
3. **Oportunidade única**: unificar `crm_leads` + `crm_sales` (espelho hoje) numa visão, depois numa tabela; remover campos que saem.
4. **Pagamentos**: `forma`, `origem_do_pagamento`, `id_externo`; regra "reabre como interesse".
5. **Página CRM** com as 3 visões e o motor de visualizações.
6. **Meta**: eventos MQL e Desqualificado; taxa de desqualificação nas análises.
7. **Dashboards**: apontar tudo para Oportunidade e Pagamento (já é assim hoje para vendas e parcelas).

Cada passo: migration com manifest, ensaio em rollback, só aplicar com "pode aplicar".

## 12. Em aberto [a confirmar]

- Nome final do selo "N oportunidades abertas" na ficha.

## 13. Decisões fechadas (15/10/2026)

- **Tag "Reativado"**: aplicada automaticamente quando um Ex-cliente em reativação volta a ser Cliente ativo (fica no histórico da pessoa).
- **Janela padrão da empresa** (quando o produto não define a própria): configurada na página CRM, aba Clientes.
- **Visualizações**: cada pessoa cria e edita as **suas**; pode **arquivar para si** a visão de outra pessoa; **não altera** o que outra pessoa criou.

## 14. Andamento

- **Passo 1 (0630) aplicado em 15/10/2026:** `crm_historico_de_estados`, `crm_stages.tipo` e `fixa`, etapa "Desqualificado" em cada funil.
- **Passo 2 (0631):** `contacts.ciclo_de_vida` (+ `ciclo_motivo`, `oportunidades_abertas`, `valor_em_aberto_cents`, `proximo_vencimento`, `dono_user_id`), janela por produto em `marketing_pages.janela_ativo_meses` (o produto é uma página de marketing), padrão da empresa em `organizations.settings.janela_ativo_meses` (6), tag "Reativado", recálculo por trigger e pela rotina diária. Na tela: coluna e filtro "Ciclo de vida" na lista, janela padrão no topo da lista, coluna "Cliente ativo (meses)" na tabela de produtos.
- **Passo 3 (0632):** etapas renomeadas para "Comprou" / "Não comprou"; entrar em "Desqualificado" encerra o card como perdido (motivo obrigatório, em todos os caminhos: lista, quadro, IA/MCP); etapas fixas não arquivam; funil novo nasce com Desqualificado. **Regra do pagamento:** card em "Comprou" sem parcela paga continua contando como **comprometido** (a pessoa segue "Em negociação"; venda, faturamento e Cliente ativo só contam com pagamento recebido). O bloqueio duro (card só entra em "Comprou" depois do sinal pago) mexe no fluxo do pop-up de venda e fica para decisão.
- **Passo 4 (0633):** parcela ganha `forma` (nasce da forma da venda), `origem_do_pagamento`, `id_externo` (único por empresa) e `confirmed_by`; parcela cancelada volta a contar como **interesse** no resumo do contato e pode ser **excluída** (`DELETE /api/v1/vendas/parcelas/:id`, só cancelada); salvar a venda passa a atualizar as parcelas por número (não perde forma/origem/avisos). **Decisão A (15/10):** card em "Comprou" sem pagamento recebido mostra o selo **"Aguardando pagamento"** (`crm_leads.com_pagamento`, mantido por trigger).
- **Passo 5 (0634):** a página Clientes virou **CRM** (`/app/clientes`) com 3 visões: **Clientes**, **Oportunidades** (um funil por vez, quadro por padrão e lista, com as próprias visualizações salvas "oportunidades") e **Vendas** (pagamentos e parcelas; `/app/vendas` redireciona). **Visualizações com dono:** cada pessoa cria e edita as suas; a de outra pessoa não se edita nem se apaga (a API recusa com 403; as antigas, sem dono, são de manager+); qualquer pessoa pode **arquivar para si** a de outra (`crm_saved_view_arquivadas`). Vale para todas as telas que usam visualizações salvas.
- **Passo 6 (sem migration):** **taxa de desqualificação** (desqualificados ÷ leads, pessoas distintas, pela etapa Desqualificado) por criativo, landing page, conjunto e anúncio. Na aba de criativos da campanha: colunas MQL, Custo por MQL, Desqualificados e Taxa de desqualificação (destaque ≥30% e ≥50%). No dashboard Tráfego Pago: colunas "Desqualif." e "Taxa desq." em Conjuntos, Anúncios e Páginas.

## 15. Atribuição pelo funil da oportunidade (15/10/2026)

- **Cliente:** a origem do cliente é a do cadastro do lead (a primeira) e não muda. Ele acumula as **tags** de todos os funis, campanhas, anúncios e páginas por onde passou.
- **Oportunidade:** cada passagem por um funil é uma oportunidade, com a própria origem. Lead reaproveitado numa campanha de reativação nasce com a **origem da campanha de tráfego** (a 1ª) e está no funil da reativação.
- **Leads e faturamento** vão para a **campanha dona do funil** em que a oportunidade está (`fn_campanha_da_oportunidade`, migration 0641; `lib/marketing/atribuicao.ts`). Se nenhuma campanha é dona do funil, vale a campanha de origem. A campanha de tráfego antiga **não é inflada** pelo que o lead fechou depois em outro funil.
- **Anúncio e landing page** só recebem o que fechou no próprio funil de origem deles.
- **Medidas do caminho até comprar:** "Funis até a 1ª compra" e "Dias até a 1ª compra" por cliente (colunas), e "Funis até comprar" (média) e "Lead → 1ª compra" (mediana e média) no dashboard Business.
