import { z } from "zod";

/** Os formatos que a API das Finanças aceita — os mesmos que o cálculo (`lib/financas/*.ts`) usa. */
export const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
export const mesIso = z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido.");
export const diaUmIso = z.string().regex(/^\d{4}-\d{2}-01$/, "Mês da fatura inválido.");
const centavos = z.number().int().min(1).max(1_000_000_000_000);

const campos = {
  data: dataIso,
  valor_cents: centavos,
  tipo: z.enum(["entrada", "saida", "transferencia"]),
  status: z.enum(["pendente", "pago", "cancelado"]),
  nota: z.string().trim().max(500).nullish(),
  category_id: z.string().uuid().nullish(),
  account_id: z.string().uuid().nullish(),
  account_destino_id: z.string().uuid().nullish(),
  fatura_mes: diaUmIso.nullish(),
  parcela_atual: z.number().int().min(1).max(60).nullish(),
  parcela_total: z.number().int().min(2).max(60).nullish(),
} as const;

/** Um lançamento novo. `organization_id`, `origem` e `created_by` NUNCA vêm do corpo. */
export const novoLancamentoSchema = z
  .object({ ...campos, status: campos.status.default("pago") })
  .strict();

/** Mudança parcial de um lançamento (o banco confere a coerência da linha inteira no fim). */
export const mudancaDeLancamentoSchema = z.object(campos).partial().strict();

export const MAXIMO_POR_REQUISICAO = 120;
export const criarLancamentosSchema = z.object({
  lancamentos: z.array(novoLancamentoSchema).min(1).max(MAXIMO_POR_REQUISICAO),
});

const tipoConta = z.enum(["corrente", "investida", "emprestada", "bem", "cartao"]);
const dia = z.number().int().min(1).max(31).nullable();
const contaCampos = {
  nome: z.string().trim().min(1).max(80),
  tipo: tipoConta,
  ativa: z.boolean(),
  ordem: z.number().int().min(0).max(32000),
  rendimento_pct: z.number().gt(0).max(1000).nullable(),
  rendimento_base: z.enum(["ano", "cdi"]).nullable(),
  dia_fechamento: dia,
  dia_vencimento: dia,
  conta_pagamento_id: z.string().uuid().nullable(),
};
export const novaContaSchema = z
  .object(contaCampos)
  .partial()
  .required({ nome: true, tipo: true })
  .strict();
export const mudancaDeContaSchema = z.object(contaCampos).partial().strict();

const categoriaCampos = {
  nome: z.string().trim().min(1).max(80),
  tipo: z.enum(["entrada", "saida"]),
  group_id: z.string().uuid().nullable(),
  cor: z.number().int().min(1).max(10).nullable(),
  ativa: z.boolean(),
  ordem: z.number().int().min(0).max(1_000_000),
  /** Meta de ganho do mês (categoria de entrada); o único orçamento de gastos é o teto do mês. */
  orcamento_mensal_cents: z.number().int().min(0).max(1_000_000_000_000),
};
export const novaCategoriaSchema = z
  .object(categoriaCampos)
  .partial()
  .required({ nome: true, tipo: true })
  .strict();
export const mudancaDeCategoriaSchema = z.object(categoriaCampos).partial().strict();

const grupoCampos = {
  nome: z.string().trim().min(1).max(80),
  ordem: z.number().int().min(0).max(1_000_000),
};
export const novoGrupoSchema = z.object(grupoCampos).partial().required({ nome: true }).strict();
export const mudancaDeGrupoSchema = z.object(grupoCampos).partial().strict();

/** Teto e meta padrão, conta das vendas, e a exceção de UM mês (valor nulo = volta ao padrão). */
export const configSchema = z
  .object({
    teto_padrao_cents: z.number().int().min(0).max(1_000_000_000_000),
    meta_padrao_cents: z.number().int().min(0).max(1_000_000_000_000),
    conta_vendas_id: z.string().uuid().nullable(),
    teto_do_mes: z.object({
      mes: mesIso,
      valor_cents: z.number().int().min(0).max(1_000_000_000_000).nullable(),
    }),
    meta_do_mes: z.object({
      mes: mesIso,
      valor_cents: z.number().int().min(0).max(1_000_000_000_000).nullable(),
    }),
  })
  .partial()
  .strict();

export const aberturaSchema = z
  .object({
    conta: z.string().uuid(),
    mes: mesIso,
    saldo_cents: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000).nullable(),
  })
  .strict();

/** Conferência de saldo: o que o banco diz × o que o app calcula; a diferença vira rendimento, ajuste ou só registro. */
export const conferenciaSchema = z
  .object({
    conta: z.string().uuid(),
    data: dataIso,
    saldo_sistema_cents: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000),
    saldo_real_cents: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000),
    destino: z.enum(["rendimento", "ajuste", "ignorar"]),
    nota: z.string().trim().max(500).nullish(),
  })
  .strict();

/** Conferência de fatura: o total que o banco diz; valor nulo remove a conferência do mês. */
export const conferenciaDeFaturaSchema = z
  .object({
    conta: z.string().uuid(),
    mes: mesIso,
    total_banco_cents: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  })
  .strict();
