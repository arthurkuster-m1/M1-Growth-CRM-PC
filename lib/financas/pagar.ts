import { hoje } from "./formato";
import type { Lancamento, NovoLancamento } from "./tipos";

/** Pagar = status pago. Se a data era futura (pagou adiantado), a data vira hoje: o saldo atual só conta o que tem data até hoje. */
export function patchPagar(l: Pick<Lancamento, "data">): Partial<NovoLancamento> {
  return l.data > hoje() ? { status: "pago", data: hoje() } : { status: "pago" };
}
export const ERRO_PAGO_FUTURO = "A data é futura. Marque como Previsto ou use a data de hoje.";
