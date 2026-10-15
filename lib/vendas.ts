import { z } from "zod";

/**
 * AS VENDAS (migration 0609): cada transação de um cliente. Uma assessoria de 6 meses são 6
 * vendas do mesmo cliente. O status diz em que pé o dinheiro está:
 *   interesse    — potencial, ainda sem compromisso;
 *   comprometida — o cliente se comprometeu: vai entrar (contas a receber);
 *   concluida    — recebida;
 *   cancelada    — não conta.
 *
 * ⚠️ A FORMA de `STATUS_DA_VENDA` é requisito de instrumento (extrator do vocabulário banco×TS).
 */
export const STATUS_DA_VENDA = ["interesse", "comprometida", "concluida", "cancelada"] as const;
export type StatusDaVenda = (typeof STATUS_DA_VENDA)[number];

export const STATUS_DA_PARCELA = ["prevista", "recebida", "cancelada"] as const;
export type StatusDaParcela = (typeof STATUS_DA_PARCELA)[number];

export const FORMAS_DE_PAGAMENTO = [
  "pix",
  "cartao_credito",
  "cartao_debito",
  "boleto",
  "transferencia",
  "dinheiro",
  "recorrencia",
  "outro",
] as const;
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number];

/** O nome da forma de pagamento na tela (`t` é o tradutor do idioma). */
export function rotuloDaForma(t: (s: string) => string, f: string): string {
  switch (f) {
    case "pix":
      return t("PIX");
    case "cartao_credito":
      return t("Cartão de crédito");
    case "cartao_debito":
      return t("Cartão de débito");
    case "boleto":
      return t("Boleto");
    case "transferencia":
      return t("Transferência");
    case "dinheiro":
      return t("Dinheiro");
    case "recorrencia":
      return t("Recorrência (assinatura)");
    case "outro":
      return t("Outra");
    default:
      return f;
  }
}


export interface ItemDaVenda {
  id?: string;
  /** O produto cadastrado em Produtos e Ofertas: toda venda é de um produto do catálogo. */
  product_id: string;
  product_name: string;
  quantity: number;
  amount_cents: number;
}

export interface ParcelaDaVenda {
  id?: string;
  number: number;
  due_on: string;
  paid_on: string | null;
  amount_cents: number;
  status: StatusDaParcela;
  /** Como esta parcela é/foi paga (por parcela; nasce da forma da venda). */
  forma?: string | null;
  origem_do_pagamento?: "manual" | "integracao";
  id_externo?: string | null;
}

export interface Venda {
  id: string;
  contact_id: string;
  lead_id: string | null;
  pipeline_id: string | null;
  demand_campaign_id: string | null;
  demand_landing_page_id: string | null;
  demand_creative_id: string | null;
  product_name: string;
  /** O nome dado à venda (vazio = usa os produtos juntados). */
  name: string;
  description: string;
  amount_cents: number;
  currency: string;
  status: StatusDaVenda;
  expected_on: string | null;
  /** A previsão de fechamento da venda (espelhada no card do funil). */
  expected_close_date: string | null;
  paid_on: string | null;
  is_recurring: boolean;
  reference: string;
  notes: string;
  payment_method: string;
  installments: number;
  closed_on: string | null;
  /** Venda efetivada automaticamente (lead ganho) que ainda precisa dos detalhes. */
  needs_details: boolean;
  /** Assinatura em andamento: a parcela do próximo mês é gerada sozinha (e cobrada). */
  recurrence_active: boolean;
  /** Assinatura: quantos meses de parcelas previstas o sistema mantém à frente (1 a 12). */
  recurrence_ahead: number;
  created_at: string;
  itens?: ItemDaVenda[];
  parcelas?: ParcelaDaVenda[];
  /** Preenchidos pela listagem (junções). */
  cliente?: { nome: string; telefone: string | null } | null;
  campanha?: string | null;
  /** O anúncio (criativo) e a landing page de origem da venda. */
  anuncio?: string | null;
  lp?: string | null;
  funil?: string | null;
  /** A etapa do card desta venda no funil (a venda anda de etapa). */
  etapa?: string | null;
  etapa_id?: string | null;
  lead_status?: "open" | "won" | "lost" | null;
  /** O responsável pela venda (o dono do card). */
  responsavel_id?: string | null;
}

export const COLUNAS_DA_VENDA =
  "id, contact_id, lead_id, pipeline_id, demand_campaign_id, demand_landing_page_id, demand_creative_id, product_name, name, description, amount_cents, currency, status, expected_on, expected_close_date, paid_on, is_recurring, reference, notes, payment_method, installments, closed_on, needs_details, recurrence_active, recurrence_ahead, created_at";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const itemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().trim().max(200).optional(),
  quantity: z.number().int().min(1).max(10000).default(1),
  amount_cents: z.number().int().min(0).max(100_000_000_000),
});
const parcelaSchema = z.object({
  number: z.number().int().min(1).max(120),
  due_on: dia,
  paid_on: dia.nullable().optional(),
  amount_cents: z.number().int().min(0).max(100_000_000_000),
  status: z.enum(STATUS_DA_PARCELA),
});

const camposSchema = z.object({
  product_name: z.string().trim().max(200),
  name: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  amount_cents: z.number().int().min(0).max(100_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(STATUS_DA_VENDA),
  expected_on: dia.nullable(),
  expected_close_date: dia.nullable(),
  paid_on: dia.nullable(),
  is_recurring: z.boolean(),
  reference: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
  demand_campaign_id: z.string().uuid().nullable(),
  payment_method: z.string().trim().max(60),
  installments: z.number().int().min(1).max(120),
  closed_on: dia.nullable(),
  recurrence_active: z.boolean(),
  recurrence_ahead: z.number().int().min(1).max(12),
  /** Quem da equipe é o responsável pela venda (mora no card do funil da venda). */
  responsavel_id: z.string().uuid().nullable(),
  itens: z.array(itemSchema).max(50),
  pagamentos: z.array(parcelaSchema).max(120),
});

/** Criar: o cliente basta; valor sai dos itens (ou de `amount_cents`). */
export const novaVendaSchema = camposSchema
  .partial()
  .extend({ contact_id: z.string().uuid(), lead_id: z.string().uuid().nullable().optional() });

/** Editar: ausente = não mexe (sem `.default()` de propósito). `itens`/`pagamentos` SUBSTITUEM. */
export const edicaoDeVendaSchema = camposSchema
  .partial()
  .extend({ needs_details: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

/** A etapa do card (negócio) a que a venda está atrelada — vem do embed `lead:crm_leads(...)`. */
function etapaDoCard(
  embed: unknown,
): Pick<Venda, "etapa" | "etapa_id" | "lead_status" | "responsavel_id"> {
  const lead = (Array.isArray(embed) ? embed[0] : embed) as
    | { stage_id?: string | null; status?: string | null; stage?: unknown; owner_user_id?: string | null }
    | null
    | undefined;
  if (!lead) return { etapa: null, etapa_id: null, lead_status: null, responsavel_id: null };
  const e = (Array.isArray(lead.stage) ? lead.stage[0] : lead.stage) as { name?: string } | null;
  const status = lead.status;
  return {
    etapa: e?.name ?? null,
    etapa_id: lead.stage_id ?? null,
    lead_status: status === "open" || status === "won" || status === "lost" ? status : null,
    responsavel_id: lead.owner_user_id ?? null,
  };
}

export function vendaDaLinha(l: Record<string, unknown>): Venda {
  const cliente = l.contact as
    | { name?: string | null; display_name?: string | null; phone_number?: string | null }
    | null
    | undefined;
  const nome =
    cliente?.display_name?.trim() || cliente?.name?.trim() || cliente?.phone_number || "—";
  const itens = Array.isArray(l.items)
    ? (l.items as Array<Record<string, unknown>>)
        .map((i) => ({
          id: i.id as string,
          product_id: String(i.product_id ?? ""),
          product_name: String(i.product_name ?? ""),
          quantity: Number(i.quantity) || 1,
          amount_cents: Number(i.amount_cents) || 0,
          position: Number(i.position) || 0,
        }))
        .sort((a, b) => a.position - b.position)
        .map(({ position: _p, ...resto }) => resto)
    : undefined;
  const parcelas = Array.isArray(l.payments)
    ? (l.payments as Array<Record<string, unknown>>)
        .map((p) => ({
          id: p.id as string,
          number: Number(p.number) || 1,
          due_on: String(p.due_on),
          paid_on: (p.paid_on as string | null) ?? null,
          amount_cents: Number(p.amount_cents) || 0,
          status: p.status as StatusDaParcela,
          forma: (p.forma as string | null | undefined) ?? null,
          origem_do_pagamento:
            p.origem_do_pagamento === "integracao" ? ("integracao" as const) : ("manual" as const),
          id_externo: (p.id_externo as string | null | undefined) ?? null,
        }))
        .sort((a, b) => a.number - b.number)
    : undefined;
  return {
    ...(l as unknown as Venda),
    itens,
    parcelas,
    amount_cents: Number(l.amount_cents) || 0,
    cliente: cliente ? { nome, telefone: cliente.phone_number ?? null } : null,
    campanha: (l.campaign as { name?: string } | null | undefined)?.name ?? null,
    anuncio: (l.creative as { name?: string } | null | undefined)?.name ?? null,
    lp: (l.landing_page as { name?: string } | null | undefined)?.name ?? null,
    funil: (l.pipeline as { name?: string } | null | undefined)?.name ?? null,
    ...etapaDoCard(l.lead),
  };
}

export interface TotaisDeVendas {
  recebido: number;
  comprometido: number;
  interesse: number;
  vendasConcluidas: number;
  ticketMedio: number | null;
}

export function totaisDeVendas(
  vendas: readonly Pick<Venda, "status" | "amount_cents">[],
): TotaisDeVendas {
  let recebido = 0;
  let comprometido = 0;
  let interesse = 0;
  let n = 0;
  for (const v of vendas) {
    if (v.status === "concluida") {
      recebido += v.amount_cents;
      n += 1;
    } else if (v.status === "comprometida") comprometido += v.amount_cents;
    else if (v.status === "interesse") interesse += v.amount_cents;
  }
  return {
    recebido,
    comprometido,
    interesse,
    vendasConcluidas: n,
    ticketMedio: n > 0 ? recebido / n : null,
  };
}

/** Meses entre a primeira e a última compra, contando os dois (assessoria de 6 meses = 6). */
export function mesesAtivo(primeira: string | null, ultima: string | null): number | null {
  if (!primeira || !ultima) return null;
  const [a1, m1] = primeira.split("-").map(Number) as [number, number];
  const [a2, m2] = ultima.split("-").map(Number) as [number, number];
  return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1);
}

/**
 * Divide o total em parcelas iguais (a sobra de centavos vai para a PRIMEIRA, para as demais
 * ficarem redondas) e espaça os vencimentos em meses. A venda em 12x de R$ 3.600 gera 12 parcelas
 * de R$ 300 — e cada uma só conta no mês em que cair.
 */
export function gerarParcelas(
  totalCents: number,
  quantidade: number,
  primeiroVencimento: string,
  intervaloEmMeses = 1,
): ParcelaDaVenda[] {
  const n = Math.max(1, Math.min(120, Math.round(quantidade)));
  const base = Math.floor(totalCents / n);
  const sobra = totalCents - base * n;
  const [a, m, d] = primeiroVencimento.split("-").map(Number) as [number, number, number];
  return Array.from({ length: n }, (_, i) => {
    const mesAlvo = m - 1 + i * intervaloEmMeses;
    const ano = a + Math.floor(mesAlvo / 12);
    const mes = ((mesAlvo % 12) + 12) % 12;
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const dia = Math.min(d, ultimo);
    return {
      number: i + 1,
      due_on: `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      paid_on: null,
      amount_cents: base + (i === 0 ? sobra : 0),
      status: "prevista" as const,
    };
  });
}

/** O que entrou e o que está previsto num mês (`AAAA-MM`): só o que de fato cai naquele mês. */
export function fluxoDoMes(
  vendas: readonly Pick<
    Venda,
    "parcelas" | "status" | "amount_cents" | "paid_on" | "expected_on"
  >[],
  mes: string,
): { recebido: number; aReceber: number } {
  let recebido = 0;
  let aReceber = 0;
  for (const v of vendas) {
    if (v.status === "cancelada" || v.status === "interesse") continue;
    if (v.parcelas && v.parcelas.length > 0) {
      for (const p of v.parcelas) {
        if (p.status === "recebida" && (p.paid_on ?? p.due_on).startsWith(mes))
          recebido += p.amount_cents;
        else if (p.status === "prevista" && p.due_on.startsWith(mes)) aReceber += p.amount_cents;
      }
    } else if (v.status === "concluida" && (v.paid_on ?? "").startsWith(mes)) {
      recebido += v.amount_cents;
    } else if (v.status === "comprometida" && (v.expected_on ?? "").startsWith(mes)) {
      aReceber += v.amount_cents;
    }
  }
  return { recebido, aReceber };
}

/** Uma parcela como o formulário da venda a guarda: valor em centavos, recebida ou não. */
export interface ParcelaDoFormulario {
  number: number;
  due_on: string;
  amount_cents: number;
  recebida: boolean;
  paid_on: string | null;
}

/**
 * AJUSTA AS PARCELAS AO TOTAL. Quando o total muda (produto novo, valor novo) as parcelas que já
 * estavam no formulário deixam de somar o total, e a venda não podia ser salva:
 *  - sem parcelas: uma parcela à vista, com o total;
 *  - já somam o total (até R$ 0,01): ficam como estão;
 *  - nenhuma recebida: refeitas com o mesmo número de parcelas e o mesmo primeiro vencimento;
 *  - alguma recebida: a diferença vai para a última ainda aberta (ou vira uma parcela nova).
 */
export function ajustarParcelasAoTotal(
  parcelas: readonly ParcelaDoFormulario[],
  totalCents: number,
  primeiroVencimento: string,
  hoje: string,
): ParcelaDoFormulario[] {
  if (totalCents <= 0) return [...parcelas];
  if (parcelas.length === 0) {
    return [
      { number: 1, due_on: primeiroVencimento || hoje, amount_cents: totalCents, recebida: false, paid_on: null },
    ];
  }
  const soma = parcelas.reduce((s, p) => s + p.amount_cents, 0);
  const diferenca = totalCents - soma;
  if (Math.abs(diferenca) <= 1) return [...parcelas];
  if (!parcelas.some((p) => p.recebida)) {
    return gerarParcelas(
      totalCents,
      parcelas.length,
      parcelas[0]!.due_on || primeiroVencimento || hoje,
    ).map((p) => ({
      number: p.number,
      due_on: p.due_on,
      amount_cents: p.amount_cents,
      recebida: false,
      paid_on: null,
    }));
  }
  let ultimaAberta = -1;
  parcelas.forEach((p, i) => {
    if (!p.recebida) ultimaAberta = i;
  });
  if (ultimaAberta < 0) {
    return [
      ...parcelas,
      { number: parcelas.length + 1, due_on: hoje, amount_cents: diferenca, recebida: false, paid_on: null },
    ];
  }
  return parcelas.map((p, i) =>
    i === ultimaAberta ? { ...p, amount_cents: Math.max(0, p.amount_cents + diferenca) } : p,
  );
}

/** O que já entrou numa venda: as parcelas recebidas (ou o total, na concluída sem parcelas). */
export function valorPagoDaVenda(v: Pick<Venda, "status" | "amount_cents" | "parcelas">): number {
  const p = (v.parcelas ?? []).filter((x) => x.status !== "cancelada");
  if (p.length === 0) return v.status === "concluida" ? v.amount_cents : 0;
  return p.filter((x) => x.status === "recebida").reduce((a, x) => a + x.amount_cents, 0);
}

/** O que está PREVISTO para entrar: o total menos o que já entrou (venda cancelada não deve nada). */
export function valorPrevistoDaVenda(
  v: Pick<Venda, "status" | "amount_cents" | "parcelas"> & { is_recurring?: boolean },
): number {
  if (v.status === "cancelada") return 0;
  // Assinatura: o previsto são as parcelas dos meses à frente (o valor da venda não cresce).
  if (v.is_recurring && (v.parcelas ?? []).length > 0) {
    return v.parcelas!
      .filter((x) => x.status === "prevista")
      .reduce((a, x) => a + x.amount_cents, 0);
  }
  return Math.max(0, v.amount_cents - valorPagoDaVenda(v));
}

/**
 * Depois de editar o valor de UMA parcela (e dar Enter), as parcelas que ainda estão abertas
 * depois dela absorvem a diferença para a soma continuar igual ao total: R$ 1.000 em 2 parcelas,
 * a primeira vira 750 e a segunda vira 250. Com várias abertas depois, a diferença se divide entre
 * elas (a sobra de centavos vai para a primeira). Sem nenhuma aberta depois, nada muda (o aviso de
 * diferença continua na tela).
 */
export function redistribuirAposEditar(
  parcelas: readonly ParcelaDoFormulario[],
  indiceEditado: number,
  totalCents: number,
): ParcelaDoFormulario[] {
  const soma = parcelas.reduce((s, p) => s + p.amount_cents, 0);
  const diferenca = totalCents - soma;
  if (diferenca === 0) return [...parcelas];
  const alvos = parcelas
    .map((p, i) => (i > indiceEditado && !p.recebida ? i : -1))
    .filter((i) => i >= 0);
  if (alvos.length === 0) return [...parcelas];
  const somaDosAlvos = alvos.reduce((s, i) => s + parcelas[i]!.amount_cents, 0);
  const novaSoma = Math.max(0, somaDosAlvos + diferenca);
  const base = Math.floor(novaSoma / alvos.length);
  const sobra = novaSoma - base * alvos.length;
  return parcelas.map((p, i) => {
    const pos = alvos.indexOf(i);
    if (pos < 0) return p;
    return { ...p, amount_cents: base + (pos === 0 ? sobra : 0) };
  });
}

/** O nome da venda na tela: o que a pessoa deu, ou os produtos juntados quando não deu nome. */
export function nomeDaVenda(v: Pick<Venda, "name" | "product_name">): string {
  return v.name?.trim() || v.product_name;
}
