import type { Conta, Lancamento } from "./tipos";
import { datasDaFatura } from "./formato";

/** Fatura = compras de um cartão com o mesmo `fatura_mes` (mês em que é PAGA). Paga = transferências para o cartão com data nesse mês. */
export type FaturaDoCartao = {
  cartao: Conta;
  mes: string;
  /** compras pagas − estornos (o que de fato está lançado) */ total: number;
  /** previstos (ainda não valem) */ previsto: number;
  jaPaga: number;
  /** parte de `jaPaga` que ainda é PREVISTA (transferência com data futura, não paga) */ pagamentoPrevisto: number;
  restante: number;
  /** data do pagamento/vencimento (do cadastro do cartão) e se já passou */ paga: string | null;
  vencida: boolean;
};

export function faturasDosCartoes(a: {
  cartoes: Conta[];
  lancamentos: Lancamento[];
  hoje: string;
}): FaturaDoCartao[] {
  const porId = new Map(a.cartoes.map((c) => [c.id, c]));
  const m = new Map<string, FaturaDoCartao>();
  const pega = (cartaoId: string, mes: string) => {
    const k = `${cartaoId}|${mes}`;
    let f = m.get(k);
    if (!f) {
      const cartao = porId.get(cartaoId)!;
      f = {
        cartao,
        mes,
        total: 0,
        previsto: 0,
        jaPaga: 0,
        pagamentoPrevisto: 0,
        restante: 0,
        paga: datasDaFatura(mes, cartao.dia_fechamento, cartao.dia_vencimento).paga ?? null,
        vencida: false,
      };
      m.set(k, f);
    }
    return f;
  };
  const vistos = new Set<string>();
  for (const l of a.lancamentos) {
    if (vistos.has(l.id) || l.status === "cancelado") continue;
    vistos.add(l.id);
    if (l.tipo === "transferencia") {
      if (l.account_destino_id && porId.has(l.account_destino_id)) {
        const f = pega(l.account_destino_id, l.data.slice(0, 7));
        f.jaPaga += l.valor_cents;
        if (l.status !== "pago") f.pagamentoPrevisto += l.valor_cents;
      }
    } else if (l.account_id && porId.has(l.account_id) && l.fatura_mes) {
      const f = pega(l.account_id, l.fatura_mes.slice(0, 7)),
        v = l.tipo === "saida" ? l.valor_cents : -l.valor_cents;
      if (l.status === "pago") f.total += v;
      else f.previsto += v;
    }
  }
  return [...m.values()]
    .map((f) => ({
      ...f,
      restante: Math.max(f.total - f.jaPaga, 0),
      vencida: !!f.paga && f.paga < a.hoje && f.total - f.jaPaga > 0,
    }))
    .sort((x, y) => x.mes.localeCompare(y.mes) || x.cartao.nome.localeCompare(y.cartao.nome));
}
export const faturasEmAberto = (todas: FaturaDoCartao[]) => todas.filter((f) => f.restante > 0);

export type SituacaoFatura = {
  tipo: "sem_compras" | "paga" | "pagamento_previsto" | "aberta" | "vencida";
  texto: string;
};
/** Em que pé está a fatura, em uma frase: paga, com pagamento previsto, em aberto ou vencida. */
export function situacaoDaFatura(
  f: FaturaDoCartao | undefined,
  brl: (c: number) => string,
  dataCurta: (iso: string) => string,
): SituacaoFatura {
  if (!f || (f.total <= 0 && f.jaPaga <= 0))
    return { tipo: "sem_compras", texto: "Sem compras nesta fatura" };
  if (f.restante === 0)
    return f.pagamentoPrevisto > 0
      ? {
          tipo: "pagamento_previsto",
          texto: `Pagamento de ${brl(f.pagamentoPrevisto)} previsto${f.paga ? ` para ${dataCurta(f.paga)}` : ""}: ainda não foi paga`,
        }
      : { tipo: "paga", texto: `Fatura paga (${brl(f.jaPaga)})` };
  const parcial = f.jaPaga > 0 ? ` · já pago ${brl(f.jaPaga)}` : "";
  return f.vencida
    ? {
        tipo: "vencida",
        texto: `Vencida${f.paga ? ` em ${dataCurta(f.paga)}` : ""}: falta pagar ${brl(f.restante)}${parcial}`,
      }
    : { tipo: "aberta", texto: `Em aberto: falta pagar ${brl(f.restante)}${parcial}` };
}
