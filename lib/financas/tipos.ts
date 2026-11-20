/**
 * Os tipos das Finanças — o formato que a API devolve e que o cálculo (`lib/financas/*.ts`, portado do
 * app da Família Kuster) consome. Dinheiro sempre em centavos.
 */
export type TipoLancamento = "entrada" | "saida" | "transferencia";
export type StatusLancamento = "pendente" | "pago" | "cancelado";
export type TipoConta = "corrente" | "investida" | "emprestada" | "bem" | "cartao";

export type Conta = {
  id: string;
  nome: string;
  tipo: TipoConta;
  ativa: boolean;
  ordem: number;
  rendimento_pct: number | null;
  rendimento_base: "ano" | "cdi" | null;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  conta_pagamento_id: string | null;
};
export type GrupoCategoria = { id: string; nome: string; ordem: number; sistema: boolean };
/** `grupo` é o NOME do grupo (preenchido pelo provedor a partir de `group_id`); quem grava usa `group_id`. */
export type Categoria = {
  id: string;
  nome: string;
  group_id: string | null;
  grupo: string | null;
  cor: number | null;
  tipo: "entrada" | "saida";
  orcamento_mensal_cents: number;
  orcamento_anual_cents: number;
  ativa: boolean;
  ordem: number;
};
export type Lancamento = {
  id: string;
  data: string;
  valor_cents: number;
  tipo: TipoLancamento;
  status: StatusLancamento;
  nota: string | null;
  category_id: string | null;
  account_id: string | null;
  account_destino_id: string | null;
  fatura_mes: string | null;
  parcela_atual: number | null;
  parcela_total: number | null;
  created_by: string | null;
  created_at: string;
  origem?: OrigemLancamento;
  ref_externa?: string | null;
};
/** O que o app envia ao criar. household_id e created_by NÃO vão: o banco preenche pelo usuário logado. */
export type NovoLancamento = Pick<
  Lancamento,
  | "data"
  | "valor_cents"
  | "tipo"
  | "status"
  | "nota"
  | "category_id"
  | "account_id"
  | "account_destino_id"
> & { fatura_mes?: string | null; parcela_atual?: number | null; parcela_total?: number | null };
export type Saldo = {
  account_id: string;
  saldo_atual_cents: number;
  base_mes: string | null;
  base_cents: number;
};
export type ConferenciaFatura = {
  id: string;
  account_id: string;
  mes: string;
  total_banco_cents: number;
  nota: string | null;
};
/** De onde veio o lançamento (ver `fin_transactions.origem`). */
export type OrigemLancamento = "manual" | "venda" | "meta" | "importacao";
export type PatrimonioDoMes = { mes: string; contas_cents: number; cartoes_cents: number };
export type DestinoConferencia = "rendimento" | "ajuste" | "ignorar";
