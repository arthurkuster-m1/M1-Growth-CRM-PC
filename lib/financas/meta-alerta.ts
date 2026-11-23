/**
 * O ALERTA DE COBRANÇA DA META — regra pura (sem banco, sem rede), usada pela rota de estado e testada.
 *
 * Há alerta quando:
 *  - a conta de anúncio está com pagamento pendente (situação 3) e isso foi lido nos últimos 2 dias; ou
 *  - houve cobrança RECUSADA nos últimos 7 dias e nenhuma cobrança paga depois dela (se o cartão
 *    passou depois, o problema se resolveu e a faixa some sozinha).
 */
export interface CobrancaDoAlerta {
  cobrada_em: string;
  estado: "paga" | "recusada" | "estornada";
  valor_cents: number | null;
}

export type AlertaMeta =
  | { tipo: "pagamento_pendente"; desde: string | null }
  | { tipo: "recusada"; em: string; valor_cents: number | null };

const DIA = 86_400_000;
export const STATUS_PAGAMENTO_PENDENTE = 3;

export function calcularAlertaMeta(
  cobrancas: CobrancaDoAlerta[],
  conta: { status: number | null; lidoEm: string | null },
  agora: Date,
): AlertaMeta | null {
  const lido = conta.lidoEm ? new Date(conta.lidoEm).getTime() : null;
  if (
    conta.status === STATUS_PAGAMENTO_PENDENTE &&
    lido !== null &&
    agora.getTime() - lido <= 2 * DIA
  ) {
    return { tipo: "pagamento_pendente", desde: conta.lidoEm };
  }
  const t = (c: CobrancaDoAlerta) => new Date(c.cobrada_em).getTime();
  const recentes = cobrancas.filter((c) => agora.getTime() - t(c) <= 7 * DIA);
  const ultimaRecusada = recentes
    .filter((c) => c.estado === "recusada")
    .sort((a, b) => t(b) - t(a))[0];
  if (!ultimaRecusada) return null;
  const pagaDepois = recentes.some((c) => c.estado === "paga" && t(c) > t(ultimaRecusada));
  if (pagaDepois) return null;
  return {
    tipo: "recusada",
    em: ultimaRecusada.cobrada_em,
    valor_cents: ultimaRecusada.valor_cents,
  };
}
