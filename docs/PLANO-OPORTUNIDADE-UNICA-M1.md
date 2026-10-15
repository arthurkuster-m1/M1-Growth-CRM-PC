# Plano do passo 7: Oportunidade única (acabar com o espelho card ↔ venda)

Documento de planejamento. **Nada aqui foi aplicado.** Escrito em 15/10/2026, depois dos passos 1 a 6 do `MODELO-CRM-M1.md`.

## 1. O problema de hoje

Uma oportunidade vive em **duas tabelas** que se espelham por triggers:

- `crm_leads` (o card do funil: etapa, dono, previsão, origem, valor) e
- `crm_sales` (a venda: nome, produtos, valor, status, forma de pagamento, recorrência, parcelas).

Consequências medidas no banco e no código (15/10/2026):

| Fato | Número |
|---|---|
| Triggers em `crm_leads` | 31 (14 deles só para manter o espelho, a origem e a venda mínima) |
| Triggers em `crm_sales` / itens / parcelas | 23 |
| Cards com mais de uma venda (`venda_adicional`) | 1 de 13 |
| Arquivos que leem `crm_sales` | 14 |
| Arquivos que leem itens ou parcelas | 11 |
| Arquivos que leem `crm_leads` | 86 |
| Tabelas que apontam para `crm_leads` por chave estrangeira | 14 |
| Dados hoje | 13 cards, 14 vendas, 0 vendas sem card, 0 cards sem venda |

O que o espelho custa: toda regra nova (origem, valor, previsão, ciclo de vida, selo "aguardando pagamento") precisa ser escrita duas vezes, e cada lugar é uma chance de divergir. Os bugs de origem e de valor da última semana vieram daí.

## 2. A ideia central: o sobrevivente é o `crm_leads`

Como `crm_leads` é referenciado por 86 arquivos e 14 tabelas, e `crm_sales` por 14 arquivos, **o caminho barato é mover a venda para dentro do card**, e não o contrário.

- A **Oportunidade** passa a ser `crm_leads` (o nome na tela já é "Oportunidade").
- Os campos da venda viram colunas da oportunidade.
- Itens (`crm_sale_items`) e parcelas (`crm_sale_payments`) passam a apontar para a oportunidade.
- `crm_sales` deixa de existir como tabela própria (vira uma *view* de compatibilidade enquanto o código migra, e some no fim).

Só os 14 arquivos que falam de venda mudam. Os 86 que falam de card continuam como estão.

## 3. O que cada campo vira

| Hoje em `crm_sales` | Destino em `crm_leads` | Observação |
|---|---|---|
| `name`, `description` | `title`, `description` | já espelhados; o nome da venda passa a ser o do card |
| `product_name`, itens | itens com `lead_id`; `product_name` derivado | |
| `amount_cents` | `value_cents` | um campo só (já é calculado dos itens) |
| `status` (interesse / comprometida / concluida / cancelada) | **derivado** da etapa e das parcelas | deixa de ser digitado |
| `expected_on` | sai | duplica a 1ª parcela e `expected_close_date` |
| `expected_close_date` | `expected_close_date` | já espelhado |
| `paid_on`, `closed_on` | `closed_at` e `paid_on` derivado da 1ª parcela | |
| `is_recurring`, `recurrence_active`, `recurrence_ahead` | mesmas colunas no card | |
| `payment_method`, `installments` | mesmas colunas no card | |
| `reference`, `notes` | mesmas colunas no card | |
| `needs_details` | sai | vira "sem próxima ação" |
| `demand_campaign_id`, criativo, landing page | já existem no card | some a regra de espelho de origem |
| `contact_id`, `pipeline_id`, `lead_id` | já são do card | |
| `created_by`, `created_at`, `updated_at` | já são do card | |

`crm_leads.venda_adicional` sai: duas oportunidades da mesma pessoa no mesmo funil passam a ser o normal, e o índice de "um card aberto por pessoa e funil" cai (ver risco 4).

## 4. Fases (cada uma é uma migration ensaiada em rollback, só aplicada com "pode aplicar")

**Fase A: preparar sem mudar nada visível (aditiva).**
1. Colunas novas no card (recorrência, forma, parcelas, referência, notas, `paid_on`).
2. `lead_id` em `crm_sale_items` e `crm_sale_payments`, preenchido a partir de `sale.lead_id`.
3. O 1 card com 2 vendas vira **2 oportunidades** (clone do card, com a segunda venda).
4. Backfill das colunas novas a partir da venda. Checagem: para cada card, os totais (pago, comprometido, previsto, interesse) calculados pelo caminho velho e pelo novo **têm de ser iguais**.

**Fase B: o código passa a escrever no card.**
5. As rotas de venda (`/api/v1/vendas`, parcelas, recorrência, importação, venda adicional) escrevem no card e nos itens/parcelas por `lead_id`.
6. As leituras (dashboards, clientes, origem por campanha, por produto) passam a ler do card. A venda continua sendo escrita em paralelo pelos triggers antigos (rede de segurança).
7. Comparação em produção por alguns dias: os mesmos números pelos dois caminhos.

**Fase C: desligar o espelho.**
8. Remove os triggers de espelho (`trg_card_para_venda`, `trg_venda_para_card`, `trg_venda_origem_do_card`, `trg_card_origem_para_vendas`, `trg_crm_sales_valor_do_lead`, `trg_lead_venda_minima`, `trg_lead_interest_sale`, `trg_lead_won_sale`).
9. `crm_sales` vira *view* somente leitura; depois é removida.
10. Saem `venda_adicional` e `needs_details`.

**Fase D: o que a unificação destrava.**
11. **Bloqueio duro do "Comprou"**: o card só entra em Comprou com a primeira parcela paga (o pop-up da venda passa a vir *antes* da mudança de etapa).
12. Lista de **Oportunidades uma linha por oportunidade** no CRM (hoje é uma linha por pessoa).
13. Status da venda totalmente derivado (acaba o campo digitado).

## 5. Riscos e como tratamos

| # | Risco | Tratamento |
|---|---|---|
| 1 | Números dos dashboards mudarem sem aviso | Fase B compara os dois caminhos no mesmo período; só desliga o antigo com diferença zero |
| 2 | A IA, o MCP, as automações e a Hotmart futura escreverem venda pelo caminho antigo | Inventário das 14 rotas/arquivos; a view de compatibilidade aceita leitura, e a escrita antiga falha alto (não em silêncio) |
| 3 | Importação de clientes e recorrência diária (cron) | Têm testes próprios; entram na Fase B com ensaio em rollback |
| 4 | Dois cards abertos da mesma pessoa no mesmo funil (índice único hoje) | Decisão sua (pergunta 1 abaixo); o índice some ou fica só para funis de pré-venda |
| 5 | Histórico de estados e ciclo de vida apontando para o card errado | Já usam `crm_leads`; só o ciclo troca a conta de "venda" para "parcelas do card" |
| 6 | Reversão | Cada fase é aditiva até a 8; a 9 em diante só roda depois de uma semana limpa. Backup lógico das duas tabelas antes da Fase C |

## 6. Como testamos

- **Equivalência:** script que, para cada organização, calcula faturamento, vendas, a receber, LTV e interesse pelo caminho velho e pelo novo e falha se houver diferença.
- **Ensaio em rollback** de cada migration, com os dados reais (13 cards e 14 vendas hoje).
- **Testes de rota** das 14 rotas que mudam (já existem para vendas, parcelas, dashboards, clientes).
- **Conferência ao vivo** pelo Arthur ao fim de cada fase (CRM, Vendas, dashboards).

## 7. Estimativa e ordem

| Fase | Trabalho | Visível para o Arthur |
|---|---|---|
| A | 1 migration + script de equivalência | nada muda |
| B | reescrita das 14 rotas/arquivos | nada muda (números iguais) |
| C | remover espelho e a tabela | CRM mais rápido, menos erros de origem |
| D | bloqueio do Comprou, lista por oportunidade | mudanças de tela |

Sugestão: **A e B numa sessão só, C numa semana depois**, com a Hotmart esperando a Fase B (assim ela já nasce escrevendo na oportunidade única).

## 8. Decisões que preciso de você

1. **Duas oportunidades abertas da mesma pessoa no mesmo funil:** liberar (cada uma com sua etapa, como o "vendeu mais alguma coisa?" de hoje) ou manter uma só aberta por funil? Recomendo **liberar**.
2. **Bloqueio duro do Comprou (Fase D):** o card só entra em Comprou com o sinal pago. Confirma que é isso, inclusive para venda lançada à mão depois do fato (nesse caso o pop-up pede a data e o valor do pagamento na hora)?
3. **Nome das tabelas:** manter `crm_leads` por baixo e chamar "Oportunidade" só na tela (recomendo, é o que mantém os 86 arquivos intactos), ou renomear no banco depois da Fase C?
4. **Status da venda digitado** (interesse / comprometida / concluída / cancelada): aceita que passe a ser sempre derivado da etapa e das parcelas, perdendo a opção de "marcar concluída" à mão?

## 9. Fora deste passo

Hotmart (entra depois da Fase B), contas a receber/pagar e dashboard financeiro (D5), e as automações de reativação por próxima recompra prevista.

## 10. Decisões fechadas (15/10/2026)

1. **Liberar** mais de uma oportunidade por pessoa, inclusive no mesmo funil. Todas as oportunidades de todos os leads aparecem na visão **Oportunidades** do CRM (uma linha por oportunidade), filtradas pelas visualizações e pelas campanhas.
2. **Bloqueio duro do Comprou:** o card só entra em Comprou depois de algum pagamento (mesmo só o sinal), inclusive em venda lançada à mão depois do fato.
3. **Tabelas:** manter `crm_leads` por baixo; "Oportunidade" só na tela.
4. **Status da venda digitado some:** os status (possível venda, comprometido, pago, cancelado) são das **parcelas**; a oportunidade só tem as etapas do funil.

## 11. Andamento

- **Fase A (0635):** ensaiada em rollback com os dados reais: divergências 0, total pago intacto (R$ 10.500,00), 13 → 14 cards (o card com 2 vendas virou 2 oportunidades; a paga foi para Comprou) e 14 vendas.
- **Fases B e C (15/10/2026):** migrations 0636 (corte) e 0637 (limpeza) aplicadas. A venda é a oportunidade (id do card); itens e parcelas só com `lead_id`; `crm_sales` e o espelho removidos; Comprou exige parcela recebida (e a primeira parcela recebida leva a Comprou sozinha); várias oportunidades por pessoa e funil; status da venda derivado (Possível venda / Comprometido / Pago / Cancelado, das parcelas); `venda_adicional` e `needs_details` removidos; Oportunidades com uma linha por oportunidade.
- **Lacunas e ajustes de 15/10/2026 (migration 0638):** arrastar para Comprou sem pagamento abre a venda em qualquer tela; dono da pessoa (coluna, ficha e ação em lote); histórico de estados e janela por produto na ficha; "ativo até" (próxima recompra); próxima ação e previsão ponderada em Oportunidades; Purchase da Meta por mensalidade de assinatura (`lead.payment_received`); lote com excluir e "Adicionar em uma nova campanha"; seletor de tags em massa; métricas da base e quadro por ciclo de vida na aba Clientes.
