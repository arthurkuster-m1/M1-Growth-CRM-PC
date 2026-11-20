import type { Conta, Lancamento, NovoLancamento, StatusLancamento } from "./tipos";
import { faturaPadrao, hoje } from "./formato";

/** Em qual mês um lançamento CAI nas visões (mesma regra da Visão do mês): compra no cartão = mês da fatura; o resto = mês da data. */
export function mesQueCai(a: {
  data: string;
  tipo: Lancamento["tipo"];
  conta: Pick<Conta, "tipo" | "dia_fechamento" | "dia_vencimento"> | undefined;
  faturaMes?: string | null;
}): string {
  if (a.conta?.tipo === "cartao" && a.tipo !== "transferencia")
    return a.faturaMes
      ? a.faturaMes.slice(0, 7)
      : faturaPadrao(a.data, a.conta.dia_fechamento, a.conta.dia_vencimento);
  return a.data.slice(0, 7);
}

/** Data inicial de um lançamento criado "dentro de um mês": hoje, se for o mês atual; senão o dia 1 (ou o 1º dia útil que o usuário ajusta). */
export function dataNoMes(mes: string, hojeISO = hoje()): string {
  return hojeISO.startsWith(mes) ? hojeISO : `${mes}-01`;
}

/* ───── Edição em massa ───── */
export type FormMassa = {
  status: StatusLancamento | ""; // "" = manter
  data: string; // "" = manter
  categoriaId: string; // "" = manter
  contaId: string; // "" = manter
  faturaMes: string; // "YYYY-MM" ou "" = manter / padrão
  nota: string; // "" = manter
  limparNota: boolean;
};
export const FORM_MASSA_VAZIO: FormMassa = {
  status: "",
  data: "",
  categoriaId: "",
  contaId: "",
  faturaMes: "",
  nota: "",
  limparNota: false,
};

/**
 * O que gravar em UM lançamento. Devolve null quando nada muda para ele. Regras:
 * categoria e fatura não se aplicam a transferência; conta nova que é cartão ganha a fatura padrão (ou a escolhida) e conta que não é cartão limpa a fatura;
 * "pago" com data futura vira a data de hoje (mesma regra de "Pagar").
 */
export function patchDaEdicaoEmMassa(
  l: Lancamento,
  f: FormMassa,
  contas: Conta[],
  hojeISO = hoje(),
): Partial<NovoLancamento> | null {
  const patch: Partial<NovoLancamento> = {};
  const transf = l.tipo === "transferencia";
  const data = f.data || l.data;
  if (f.data && f.data !== l.data) patch.data = f.data;
  if (f.status && f.status !== l.status) patch.status = f.status;
  const status = f.status || l.status;
  if (status === "pago" && data > hojeISO) {
    patch.data = hojeISO;
  }
  const dataFinal = patch.data ?? data;
  if (!transf && f.categoriaId && f.categoriaId !== l.category_id)
    patch.category_id = f.categoriaId;
  if (f.contaId && f.contaId !== l.account_id) patch.account_id = f.contaId;
  if (!transf) {
    const conta = contas.find((c) => c.id === (patch.account_id ?? l.account_id));
    const mudouConta = patch.account_id !== undefined,
      mudouData = patch.data !== undefined;
    if (conta?.tipo === "cartao") {
      if (f.faturaMes) {
        if (l.fatura_mes?.slice(0, 7) !== f.faturaMes) patch.fatura_mes = `${f.faturaMes}-01`;
      } else if (mudouConta || mudouData || !l.fatura_mes)
        patch.fatura_mes = `${faturaPadrao(dataFinal, conta.dia_fechamento, conta.dia_vencimento)}-01`;
    } else if (mudouConta && l.fatura_mes) patch.fatura_mes = null;
  }
  if (f.limparNota && l.nota) patch.nota = null;
  else if (!f.limparNota && f.nota.trim() && f.nota.trim() !== (l.nota ?? ""))
    patch.nota = f.nota.trim();
  return Object.keys(patch).length ? patch : null;
}
