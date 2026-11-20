import type { Categoria, Conta, Lancamento } from "./tipos";
import { mesSeguinte } from "./formato";
import { calcularMes } from "./mes";

/**
 * Saldo de cada conta no início de um mês FUTURO: parte do início do mês atual e encadeia a previsão de
 * fechamento de cada mês até chegar lá (assim a fatura que ainda vai sair do caixa em novembro já
 * desconta o saldo com que dezembro começa). Só o que está lançado entra; não inventa recorrência.
 */
export async function projetarInicio(a: {
  de: string;
  ate: string;
  hoje: string;
  inicioDe: Record<string, number>;
  contas: Conta[];
  categorias: Categoria[];
  carregar: (mes: string) => Promise<{ doMes: Lancamento[]; daFatura: Lancamento[] }>;
}): Promise<Record<string, number>> {
  let inicio = a.inicioDe;
  for (let mes = a.de, voltas = 0; mes < a.ate && voltas < 36; mes = mesSeguinte(mes), voltas++) {
    const { doMes, daFatura } = await a.carregar(mes);
    const r = calcularMes({
      mes,
      hoje: a.hoje,
      contas: a.contas,
      categorias: a.categorias,
      doMes,
      daFatura,
      inicio,
    });
    const proximo: Record<string, number> = { ...inicio };
    for (const c of r.contas) proximo[c.conta.id] = c.previsto;
    // dinheiro de fatura sem conta de pagamento sai do caixa total: abate da primeira conta corrente
    if (r.patrimonio.faturaSemConta > 0) {
      const primeira = r.contas.find((c) => c.conta.tipo === "corrente");
      if (primeira) proximo[primeira.conta.id]! -= r.patrimonio.faturaSemConta;
    }
    inicio = proximo;
  }
  return inicio;
}
