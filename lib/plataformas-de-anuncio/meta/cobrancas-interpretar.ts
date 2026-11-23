/**
 * Lê UMA atividade da conta de anúncio e diz se ela é uma cobrança no cartão — módulo puro, sem rede.
 *
 * ⚠️ Os nomes de evento e o formato de `extra_data` abaixo vêm da documentação pública da Graph e NÃO
 * foram conferidos contra uma conta real: a sonda (`/api/v1/financas/meta/sonda`) existe justamente
 * para isso. Por isso:
 *  - "paga" e "estornada" só valem para nomes EXATOS conhecidos (um falso positivo criaria despesa que
 *    não existe);
 *  - "recusada" aceita também o padrão amplo (o erro seguro é avisar demais, nunca de menos);
 *  - se o valor não vier, a cobrança é guardada SEM valor (não vira lançamento; aparece para conferir).
 * Ajustar a lista quando a sonda mostrar os nomes reais é uma troca de uma constante.
 */

export type EstadoDaCobranca = "paga" | "recusada" | "estornada";

export interface CobrancaLida {
  /** Id da cobrança na plataforma (ou chave estável montada do evento). */
  metaId: string;
  /** ISO 8601 (UTC). */
  cobradaEm: string;
  /** Centavos; null quando a plataforma não informou. */
  valorCents: number | null;
  moeda: string;
  estado: EstadoDaCobranca;
  tipoEvento: string;
  /** O evento como veio (cortado), para conferência. */
  bruto: Record<string, unknown>;
}

export interface AtividadeCrua {
  event_type?: string;
  event_time?: string;
  object_id?: string;
  extra_data?: unknown;
  [chave: string]: unknown;
}

const PAGA = new Set(["ad_account_billing_charge"]);
const ESTORNADA = new Set(["ad_account_billing_chargeback", "ad_account_billing_refund"]);
const RECUSADA_EXATA = new Set(["ad_account_billing_charge_failed", "ad_account_billing_decline"]);
/** Qualquer evento de cobrança/pagamento com cara de falha. */
const RECUSADA_AMPLA = /(billing|payment|charge|funding)/;
const FALHA = /(fail|declin|reject|denied|unsuccess)/;

export function classificarEvento(tipo: string): EstadoDaCobranca | null {
  const t = tipo.toLowerCase();
  if (RECUSADA_EXATA.has(t)) return "recusada";
  if (PAGA.has(t)) return "paga";
  if (ESTORNADA.has(t)) return "estornada";
  if (RECUSADA_AMPLA.test(t) && FALHA.test(t)) return "recusada";
  return null;
}

function objetoDe(extra: unknown): Record<string, unknown> {
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    return extra as Record<string, unknown>;
  }
  if (typeof extra === "string") {
    try {
      const v: unknown = JSON.parse(extra);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // texto solto: sem campos
    }
  }
  return {};
}

const CAMPOS_DE_VALOR = ["new_value", "amount", "value", "charge_amount", "total_amount"];

function numeroDe(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

/** Valor em centavos (unidade menor da moeda). Sempre positivo: o sentido vem do estado. */
export function valorDaCobranca(extra: Record<string, unknown>): number | null {
  for (const campo of CAMPOS_DE_VALOR) {
    const n = numeroDe(extra[campo]);
    if (n !== null) return Math.round(Math.abs(n));
  }
  return null;
}

function instante(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  // "2026-11-10T15:00:00+0000" → "+00:00" (nem todo motor aceita sem os dois pontos)
  const t = texto.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const LIMITE_DO_BRUTO = 1500;

export function interpretarAtividade(
  item: AtividadeCrua,
  conta: string,
  moedaPadrao = "BRL",
): CobrancaLida | null {
  const tipo = typeof item.event_type === "string" ? item.event_type : "";
  const estado = classificarEvento(tipo);
  if (!estado) return null;
  const cobradaEm = instante(item.event_time);
  if (!cobradaEm) return null;

  const extra = objetoDe(item.extra_data);
  const idDaPlataforma = [extra.transaction_id, extra.tx_id, extra.charge_id].find(
    (v) => (typeof v === "string" && v.trim() !== "") || typeof v === "number",
  );
  const metaId =
    idDaPlataforma !== undefined
      ? String(idDaPlataforma).trim()
      : `${conta}:${tipo}:${cobradaEm}:${typeof item.object_id === "string" ? item.object_id : ""}`;

  const moedaCrua = extra.currency ?? extra.new_currency;
  const moeda =
    typeof moedaCrua === "string" && /^[A-Za-z]{3}$/.test(moedaCrua)
      ? moedaCrua.toUpperCase()
      : moedaPadrao.toUpperCase();

  const texto = JSON.stringify(item);
  const bruto: Record<string, unknown> =
    texto.length <= LIMITE_DO_BRUTO
      ? (JSON.parse(texto) as Record<string, unknown>)
      : { event_type: tipo, event_time: item.event_time, extra_data: extra };

  return {
    metaId: metaId.slice(0, 200),
    cobradaEm,
    valorCents: valorDaCobranca(extra),
    moeda,
    estado,
    tipoEvento: tipo,
    bruto,
  };
}
