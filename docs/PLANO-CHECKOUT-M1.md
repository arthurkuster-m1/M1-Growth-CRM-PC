# PLANO DE CHECKOUT PRÓPRIO (link de pagamento)

Registrado em 04/11/2026. **Só plano: nada disto foi construído.** Ideia do Arthur: mandar ao
cliente um **link de checkout do próprio CRM**; quando ele paga, a venda entra e é baixada
**sozinha**, sem ninguém atualizar o CRM à mão.

## 1. O problema que isto resolve

Hoje a venda é lançada à mão (`/app/vendas`: `crm_sales`, itens `crm_sale_items`, parcelas
`crm_sale_payments` com status `prevista`/`recebida`/`cancelada`). Quem recebe o dinheiro precisa
lembrar de marcar a parcela como recebida. Com o checkout, **o pagamento confirmado dá a baixa**:
a parcela vira `recebida`, o lead vira ganho, o LTV, o faturamento e os dashboards atualizam e a
campanha de origem recebe a venda (CAPI incluído) — tudo o que já existe, só que disparado pelo
pagamento e não por uma pessoa.

## 2. Decisão de desenho (a mais importante)

**O CRM faz a tela e o fluxo; quem move o dinheiro é um intermediário de pagamento (PSP).**

- Cada empresa (cliente da agência) conecta **a própria conta** num PSP; o dinheiro cai na conta
  dela, nunca na nossa. Assim não somos instituição financeira nem guardamos dinheiro de terceiros.
- **Dados de cartão nunca passam pelo nosso servidor.** O campo de cartão é do PSP (tokenização/
  campo hospedado). O CRM só recebe um token. Isso evita a norma PCI e o risco jurídico.
- **Conectar "direto no banco"** (API Pix de cada banco, certificado, conciliação) fica fora do
  começo: cada banco tem a sua API e exige cadastro. Só entra se um cliente grande pedir.

PSPs candidatos (escolher UM para começar, com o Arthur): **Asaas**, **Mercado Pago**, **Pagar.me**,
**Efí** (bom em Pix) e **Stripe** (bom em cartão e assinatura). Critérios: Pix + cartão + boleto por
API, webhook assinado, conta própria por cliente (OAuth/chave), taxa, e se tem sandbox. Todos
cobram taxa do recebedor; a taxa já tem onde entrar (`payment_fee_settings`).

## 3. O que já existe e será reaproveitado

| Peça | Onde | Papel no checkout |
|---|---|---|
| Venda, itens e parcelas | `crm_sales`, `crm_sale_items`, `crm_sale_payments` | A cobrança nasce de uma venda/parcela; pagar = parcela `recebida` |
| Formas de pagamento e contas | `payment_methods`, `financial_accounts` | Pix/cartão apontam para a conta onde o dinheiro cai |
| Taxas | `payment_fee_settings` | Taxa do PSP vira lançamento/ajuste |
| Link público por token | `app/api/v1/vendas/parcelas/[token]`, `/p/<token>` | O link do checkout segue o mesmo padrão: token, sem login, só o necessário |
| Webhooks de entrada | `app/api/v1/webhooks/*` | Aviso de pagamento do PSP (HMAC, idempotente) |
| Catálogo de produtos | Marketing › Produtos e ofertas (`catalog_products`) | Itens do checkout e preço único |
| Lead, ganho, LTV, CAPI | CRM (sessões 6 e 7 do `PLANO-CRM-M1.md`) | Efeitos da venda paga |
| Segredos cifrados | `private.app_secrets` e cifra AES dos segredos | Guardar as chaves do PSP de cada empresa |

## 4. Fases

**C0 — Decisões (com o Arthur, antes de codar).** Qual PSP primeiro; só Pix ou Pix + cartão; à
vista ou também parcelado/recorrente; quem paga a taxa (empresa ou cliente final); layout do
checkout (marca da empresa, cor e logo já existem).

**C1 — Conectar o PSP (por empresa).** Tela em Conexões: colar a chave (ou OAuth) do PSP da
empresa, testar, guardar cifrada. Nada de chave na tela depois de salva.

**C2 — Cobrança por link, Pix primeiro.** Botão "Gerar link de pagamento" na venda/parcela →
cria a cobrança no PSP → página pública `/pagar/<token>` com QR Code e copia-e-cola → link para
copiar e mandar pelo WhatsApp. Pix é o mais simples (sem cartão, sem PCI) e o mais usado.

**C3 — Baixa automática.** Webhook do PSP (assinatura verificada, idempotente por id do evento,
`unique (organization_id, external_id)`) → marca a parcela `recebida`, grava a data, move o lead
para ganho, dispara LTV/dashboards/CAPI e deixa rastro na linha do tempo e no audit log. Valor
recebido diferente do esperado e estorno viram aviso na Central, nunca baixa em silêncio.

**C4 — Cartão.** Campo hospedado do PSP, parcelamento, 3-D Secure quando exigido, recusa com
mensagem clara e nova tentativa.

**C5 — Recorrência, reembolso e boleto.** Assinaturas (reaproveita vendas recorrentes), estorno
pela tela, boleto e vencidos (lembrete pelo follow-up).

**C6 — Checkout "de carrinho".** Link com produto da oferta (sem venda prévia): o cliente escolhe,
paga, e a venda e o lead nascem do pagamento.

## 5. Regras que não se negociam

- Dinheiro na conta da empresa cliente; **nunca** custódia nossa.
- Cartão só pelo campo do PSP; nada de número de cartão em log, banco ou erro.
- Webhook com assinatura verificada em tempo constante e **idempotência** (mesmo evento 2x = 1 baixa).
- `organization_id` do link/token resolvido no servidor, nunca do corpo. Token público de pagamento
  de uso limitado (expira e é revogável), sem expor dados do lead além do necessário.
- Toda mutação audita; baixa automática grava de onde veio (`origem = checkout`) para o financeiro
  distinguir do lançamento manual.
- Segredos do PSP cifrados como os demais; rotação sem refazer a integração.
- Prova com **receiver real e sandbox do PSP**, e teste de pagamento duplicado, atrasado, parcial e
  estornado antes de uma empresa usar com dinheiro de verdade.

## 6. Pontos a levar ao Arthur

1. Qual PSP primeiro? (Asaas e Efí costumam ser os mais simples para Pix no Brasil.)
2. Os clientes finais pagam por Pix, cartão ou os dois? Parcelado?
3. Quem arca com a taxa?
4. O link deve criar a venda sozinho (C6) ou só cobrar vendas já lançadas (C2)? Sugestão: C2 primeiro.
5. Precisa de nota fiscal junto? (Fora do escopo aqui; é outro projeto.)

## 7. Onde isto entra no plano geral

É parte da frente **15 — Financeiro completo** e fecha a frente de **CRM › Vendas** (sessão 7):
deixa de depender de lançamento manual. Depende de: Go-live estável (frente 18) e das vendas
atuais (`app/api/v1/vendas`). Estimativa grosseira: C1+C2+C3 (Pix com baixa automática) é o
primeiro marco útil; cartão e recorrência vêm depois.
