/**
 * As TAXAS das formas de pagamento: o que cada forma cobra e quem paga.
 * A taxa paga pela empresa é custo variável; a paga pelo cliente final não sai do bolso dela.
 */
import { z } from "zod";

export const FORMAS_PRINCIPAIS = ["pix", "cartao_credito", "cartao_debito"] as const;
export type FormaPrincipal = (typeof FORMAS_PRINCIPAIS)[number];

export const QUEM_PAGA = ["client", "company"] as const;
export type QuemPaga = (typeof QUEM_PAGA)[number];

export interface TaxaDaForma {
  forma: string;
  /** Nome da forma criada pela empresa; vazio nas principais. */
  name: string | null;
  is_custom: boolean;
  payer: QuemPaga;
  /** Percentual em centésimos de ponto (299 = 2,99%). */
  percent_bps: number;
  fixed_cents: number;
  /** Cartão de crédito: taxa por número de parcelas. */
  installment_bps: Record<string, number>;
}

export const taxaSchema = z.object({
  forma: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(60).nullish(),
  payer: z.enum(QUEM_PAGA).default("company"),
  percent_bps: z.coerce.number().int().min(0).max(10000).default(0),
  fixed_cents: z.coerce.number().int().min(0).default(0),
  installment_bps: z.record(z.string().regex(/^\d{1,3}$/), z.coerce.number().int().min(0).max(10000)).default({}),
});

export const SEM_TAXA = (forma: string): TaxaDaForma => ({
  forma,
  name: null,
  is_custom: forma.startsWith("outra:"),
  payer: "company",
  percent_bps: 0,
  fixed_cents: 0,
  installment_bps: {},
});

/** A chave de uma forma nova ("Link do Stripe" → "outra:link-do-stripe"). */
export function chaveDaFormaNova(nome: string): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `outra:${slug || "forma"}`;
}

/** A taxa percentual (bps) que vale para esse número de parcelas. */
export function bpsPara(taxa: TaxaDaForma, parcelas: number): number {
  if (taxa.forma === "cartao_credito") {
    const n = Math.max(1, Math.round(parcelas) || 1);
    const exata = taxa.installment_bps[String(n)];
    if (exata !== undefined) return exata;
    // Sem a faixa cadastrada, vale a maior faixa menor que ela; sem nenhuma, o percentual base.
    const menores = Object.keys(taxa.installment_bps)
      .map(Number)
      .filter((k) => k <= n)
      .sort((a, b) => b - a);
    if (menores.length > 0) return taxa.installment_bps[String(menores[0])]!;
  }
  return taxa.percent_bps;
}

/**
 * A taxa de UM recebimento, em centavos, e o líquido que a empresa fica.
 * `valor_cents` é o que o cliente pagou (já inclui a taxa quando o cliente final arca).
 */
export function taxaDoRecebimento(
  taxa: TaxaDaForma | undefined,
  valor_cents: number,
  parcelas: number,
): { taxa_cents: number; custo_cents: number; liquido_cents: number } {
  if (!taxa) return { taxa_cents: 0, custo_cents: 0, liquido_cents: valor_cents };
  const taxa_cents = Math.round((valor_cents * bpsPara(taxa, parcelas)) / 10000) + taxa.fixed_cents;
  // Cliente final paga: a empresa recebe o valor cheio (a taxa foi embutida no preço).
  const custo_cents = taxa.payer === "company" ? taxa_cents : 0;
  return { taxa_cents, custo_cents, liquido_cents: valor_cents - custo_cents };
}

/** O nome da forma na tela, cuidando das formas criadas pela empresa. */
export function rotuloDaFormaComTaxas(
  t: (s: string) => string,
  forma: string,
  taxas: ReadonlyArray<Pick<TaxaDaForma, "forma" | "name">>,
): string | null {
  const custom = taxas.find((x) => x.forma === forma)?.name;
  if (custom) return custom;
  if (forma.startsWith("outra:")) return forma.slice(6).replace(/-/g, " ");
  return null;
}
