# PLANO — Finanças do CRM (réplica do app de Finanças da Família Kuster, adaptada à empresa)

> **Andamento (20/11/2026): M0, F1, F2 e F3 feitos** (ver `CONTEXTO-M1.md`). Escrito a partir da leitura do app `familia-kuster` (`src/pages/financas`, `src/lib/financas`, `supabase/migrations/*financas*`, `docs/plano-financas.md`) e do que o CRM já tem. **Nada disto foi construído ainda.** O Arthur escolhe a ordem; uma fase de cada vez, testada.

## 1. O que vem da família (igual, tela por tela)

| Tela | O que tem |
|---|---|
| **Visão geral** | patrimônio (dinheiro nas contas) com variação, evolução de 12 meses (gráfico + tabela Mês/Entradas/Saídas/Resultado/Patrimônio), médias dos 4 meses, "podemos gastar no débito/crédito", maiores gastos, alertas, contas com saldo e rendimento, faturas em aberto, **Conferir saldo** |
| **Mês** | "Ainda podemos gastar" (teto do mês, ritmo por dia até virar o cartão), "Ainda falta ganhar" (meta), Entradas/Saídas/Resultado/Previsão de patrimônio, alertas recolhíveis, pizza por categoria clicável, tabela de lançamentos (Todos/Previstos/Pagos, filtro, busca, ordenar, editar vários, botão Pagar), lançar entrada/saída já para aquele mês |
| **Ano** | cartões do ano, barras entradas × saídas (listrado = previsto), tabela mês a mês, renda por fonte, gasto por categoria, comparar anos |
| **Faturas** | por cartão e mês: total do app × total do banco ("bate / diferença de R$ X"), faturas em aberto, **Pagar fatura** (cria a transferência conta → cartão) |
| **Lançamentos** | Lista e **Em massa** (grade estilo Excel: cola do Google Sheets e CSV, prévia por linha, não duplica ao reimportar, "Caixa" vira saldo de abertura) |
| **Lançar** | entrada, saída, transferência; previsto/pago; compra **parcelada** com prévia das parcelas; categoria criada na hora |
| **Configurações** | contas (saldo de abertura, rendimento % CDI ou % ao ano), cartões (fechamento, vencimento, conta de pagamento), categorias e grupos (ordem, cor, meta de ganho), teto do mês, meta de ganhos |

**Regras que ficam como estão** (já testadas lá, e a maior parte é TypeScript puro que será copiado com os testes): transferência não é entrada nem saída; `pendente` não mexe no saldo mas entra na previsão; `cancelado` não conta; compra no cartão cai no mês da **fatura** (mês em que é paga); patrimônio = só o dinheiro nas contas; pagar fatura = transferência para o cartão; conferência de saldo vira rendimento, ajuste ou só registro; teto do mês é o único orçamento de gastos.

## 2. O que muda para a empresa

1. **Cada empresa (organização) tem as suas finanças**, com RLS por `organization_id` (no lugar do `household_id` da família). A agência (Assessoria M1) é uma organização como as outras.
2. **Entradas vêm das vendas, sozinhas** (seção 4). Entradas manuais continuam existindo (outras receitas, aportes).
3. **Categorias iniciais de empresa** (no lugar de For Art/Baby/Pet…): Vendas, Tráfego pago, Ferramentas, Equipe/Comissões, Impostos, Aluguel… (editáveis).
4. **Fatura do cartão da Meta puxada da Meta** (seção 5).
5. **Saem do escopo da família**: repasse mensal / Salário Duda, backup por aparelho (o CRM já tem backup), metas de longo prazo e planejamento de renda por clientes (pode voltar depois como "meta de faturamento").
6. A tela atual **Finanças** (faturamento por forma/pessoa/produto/cliente + catálogo financeiro) **não é apagada**: vira abas "Vendas" e "Catálogo" ao lado das telas novas.

## 3. Dados (migrations a partir da 0700, cada uma também no fim do `baseline.sql`)

Tabelas novas `fin_*` (**não** reaproveitam `financial_entries`, que é o livro-razão das comandas: não tem transferência, cartão nem fatura):

`fin_accounts` (tipo corrente/investida/emprestada/bem/cartao, fechamento, vencimento, conta de pagamento, rendimento) · `fin_category_groups` · `fin_categories` (cor, ordem, meta de ganho) · `fin_transactions` (tipo entrada/saida/transferencia, status pendente/pago/cancelado, `fatura_mes`, parcelas, `import_hash`, **`origem`** manual/venda/meta/importacao e **`ref_externa`** com índice único por organização) · `fin_balance_snapshots` · `fin_reconciliations` · `fin_invoice_checks` · `fin_orcamento_config` + `fin_teto_mensal` + `fin_meta_mensal` · `fin_cobrancas_meta` (seção 5).
Funções/visões: saldo por conta, fluxo mensal, `fin_saldos_na_data`, `fin_patrimonio_mensal`, totais de fatura, gatilho `fn_fin_tx_fatura` — portadas das migrations 0002/0007/0008/0011/0016 da família, com `organization_id`. Função nova em `public`: `revoke execute ... from public, anon`.

Leitura/escrita pelas rotas `/api/v1/financas/*` (`requireRole` + `requireSupportWrite` antes de gravar, `ok()/fail()`, `audit()`, Zod). Ações novas em `lib/audit/actions.ts`.

## 4. Vendas → entradas automáticas

- Fonte: `crm_sale_payments` (parcelas das vendas, ligadas ao lead; é o que a tela Finanças atual já usa).
- `recebida` → entrada **paga** na data `paid_on`; `prevista` → entrada **pendente** em `due_on`; `cancelada` → `cancelado`. Venda perdida some das previstas (mesma regra de `fn_relatorio_financas`).
- Um lançamento por parcela, `origem = 'venda'`, `ref_externa = 'venda:<id da parcela>'` → **não duplica nunca** e acompanha mudanças (valor, data, status) por gatilho em `crm_sale_payments` (o gatilho só escreve em `fin_transactions`; nada de HTTP).
- Conta de destino: a conta ligada à forma de pagamento da parcela; sem forma, a "conta padrão de vendas" escolhida em Configurações. Categoria: **Vendas** (do sistema).
- Lançamento vindo de venda mostra o selo "Venda" e o nome do cliente; valor/data/status são da venda (editar é na venda); conta e anotação podem ser ajustadas.
- Na ativação, **preenchimento retroativo** de todas as parcelas existentes (idempotente).
- Vendas que ainda estão em "comprometida/interesse" sem parcela **não** viram entrada (continuam sendo previsão de vendas, não de caixa).

## 5. Fatura do cartão puxada da Meta — o que sabemos e o que falta provar

**Pedido:** somar exatamente o que foi cobrado no cartão (não o gasto das campanhas, que difere por imposto), com a data da cobrança, e avisar no app quando a cobrança falhar.

**O que a documentação oficial da Meta indica** (lido nos resultados de busca que citam a documentação; **não consegui abrir developers.facebook.com a partir desta sessão**, então nada abaixo é conferido contra a API viva):
- **Atividades da conta de anúncio** (`/act_<ID>/activities`): registram eventos de cobrança — **cobranças, recusas, estornos (chargeback), reembolsos e troca de forma de pagamento**; por padrão devolve 1 semana, dá para pedir intervalo (`since`/`until`). É a melhor candidata para "cobrança no cartão com data" e para "cobrança recusada".
- **Conta de anúncio**: o campo `account_status` tem o estado "pendente de pagamento" (UNSETTLED, código 3) — serve de **alarme** de falha de pagamento mesmo quando o detalhe do evento não vier; há também dados da forma de pagamento (`funding_source_details`).
- **Faturas mensais (`business_invoices`)**: só existem para contas com faturamento mensal (boleto/crédito estendido), **não** para quem paga com cartão no automático.
- `spend` dos insights **não** entra: é o valor das campanhas, sem imposto — é justamente o que o Arthur não quer.

**O que NÃO está provado** (e decide se dá para fazer 100%): se o token que temos hoje (colado em Conexões › Meta Ads, com `ads_read`) tem permissão para ler essas atividades de cobrança — pode exigir `ads_management` ou `business_management`; se o evento traz **valor exato com imposto, moeda, data e final do cartão**; quanto histórico a Meta devolve.

**Por isso a primeira entrega é uma SONDA, somente leitura:** uma rota de administrador que, com o token já salvo da empresa, chama `activities` (filtrando cobrança), a conta (`account_status`, forma de pagamento) e as faturas, e mostra **o retorno cru** na tela. Com isso decidimos com dado real, sem chute.

**Desenho, se a sonda confirmar:**
- Em Configurações › Cartões, o cartão "da Meta" (qual cartão a Meta cobra) fica ligado à conexão da Meta.
- Rotina (cron `financas-meta`, junto de `campanhas-meta`; **linha nova no crontab da VPS**, à mão) lê as cobranças e grava em `fin_cobrancas_meta` (id da Meta, data/hora, valor cobrado, moeda, estado: paga/recusada/estornada, JSON cru).
- Cobrança **paga** → `fin_transactions` saída no cartão da Meta, `origem = 'meta'`, `ref_externa = 'meta:<id>'`, categoria "Tráfego pago", `fatura_mes` pelo fechamento do cartão (a fatura do cartão passa a somar **o que foi cobrado**).
- Cobrança **recusada** ou conta em `UNSETTLED` → **alerta** na Visão geral/Mês/Faturas (faixa vermelha) **e notificação** na central de notificações do CRM (push), para quem administra as finanças. Estorno entra como entrada no cartão.
- Conferência de fatura: o botão existente compara o total do app com o total do banco; diferença aponta cobrança que a Meta não mostrou.
- Se a Meta **não** der esses dados pela API: plano B = lançar a cobrança à mão/importar o CSV do extrato de cobranças do Gerenciador, com o mesmo `ref_externa` para não duplicar.

## 6. Fases (cada uma termina testada e com o Arthur vendo)

| # | Entrega | Pronto quando |
|---|---|---|
| **M0** | **Sonda da Meta** (só leitura, só admin) | retorno cru das cobranças aparece na tela; decidimos o desenho da seção 5 |
| **F1** | **Base**: migrations `fin_*` + RLS + funções, portar `lib/financas` com os testes, rotas de leitura | testes verdes; tela vazia carrega sem erro |
| **F2** | **Configurações + Lançar + Lançamentos (lista)**: contas, cartões, categorias/grupos, lançar entrada/saída/transferência/parcelado, editar, pagar, cancelar | lança e vê a lista do mês |
| **F3** | **Vendas → entradas automáticas** (seção 4) + retroativo | venda recebida/prevista aparece sozinha como entrada |
| **F4** | **Visão do mês** | teto, meta, pizza, tabela, alertas |
| **F5** | **Visão geral + Conferir saldo** | patrimônio, evolução, conferência |
| **F6** | **Faturas + Pagar fatura** (+ conferência com o banco) | fatura bate/diferença; pagar cria a transferência |
| **F7** | **Ano + Comparar anos** | tabelas e gráficos do ano |
| **F8** | **Em massa** (planilha/CSV) | cola e importa sem duplicar |
| **F9** | **Cobranças da Meta** (seção 5, conforme a sonda) + alerta de falha | fatura do cartão da Meta soma as cobranças reais |

Ordem sugerida: **M0 → F1 → F2 → F3 → F4 → F5 → F6 → F9 → F7 → F8** (o que dá valor ao caixa da empresa vem primeiro).

## 7. Como será portado (decisões técnicas)

- **`src/lib/financas/*.ts` da família** (cálculo puro: mês, ano, faturas, parcelas, ritmo, teto, histórico, tabela do ano, comparar anos, importação) vão para `lib/financas/` quase literais, **com os testes deles** — é aí que está a regra de negócio, e já está provada.
- **Telas**: mesmo método das Anotações — o CSS da família (`.mes-*`, `.ano-*`, `.fat-*` + peças `ds-*`) vira `app/financas-visual.css` com as **mesmas classes**, tudo dentro de `.fi-raiz`; só a cor de marca vem do tema do CRM. Componentes copiados com ajustes: `react-router` → `next/navigation`; acesso direto ao Supabase → rotas `/api/v1/financas/*` + React Query.
- **Grade em massa**: `react-datasheet-grid` (o CRM já usa em Importar leads). **Cuidado com o aviso da família:** o `react-resize-detector` precisa do `override` para React 19 (verificar se o CRM já tem).
- **Gráficos**: os da família são SVG próprios (`graficos.tsx`), vão junto.
- Tela nova precisa de porta em `lib/navigation/catalogo.ts`; texto em `t("português")`; sem `console.log`; env nova em `.env.example` + `lib/env.ts`.
- Dinheiro sempre em centavos (`bigint`), moeda BRL (a moeda da organização fica como está na tela de Vendas).

## 8. Decisões que dependem do Arthur

1. **Quem vê e quem lança as finanças da empresa?** (sugestão: ver e lançar = gerente ou acima; operador/visualizador não veem.)
2. **Uma conta/cartão por empresa ou várias?** (a família suporta várias; sugestão: várias, com "conta padrão de vendas".)
3. **Qual cartão a Meta cobra** em cada empresa (cadastrado em Configurações › Cartões, com dia de fechamento e vencimento).
4. **Autorizar a sonda da Meta** (M0): ela só lê, usa o token que já está salvo, e mostra o resultado só para administradores.
