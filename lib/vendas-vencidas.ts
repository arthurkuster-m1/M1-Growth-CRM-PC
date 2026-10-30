/**
 * AS PARCELAS VENCIDAS: dinheiro que devia ter entrado e não entrou. Em vez de enfeitar o dashboard,
 * viram UM aviso por empresa na Central de avisos (aberto e atualizado todo dia; resolvido quando não
 * sobra nada vencido). Contas puras; quem lê e escreve no banco é `avisarParcelasVencidas`.
 */
export interface ParcelaVencida {
  organization_id: string;
  lead_id: string;
  amount_cents: number;
}

export interface VencidoDaEmpresa {
  organization_id: string;
  valor_cents: number;
  vendas: number;
  parcelas: number;
}

export function vencidoPorEmpresa(parcelas: readonly ParcelaVencida[]): VencidoDaEmpresa[] {
  const porEmpresa = new Map<string, { valor: number; vendas: Set<string>; parcelas: number }>();
  for (const p of parcelas) {
    const e = porEmpresa.get(p.organization_id) ?? { valor: 0, vendas: new Set<string>(), parcelas: 0 };
    e.valor += p.amount_cents;
    e.vendas.add(p.lead_id);
    e.parcelas += 1;
    porEmpresa.set(p.organization_id, e);
  }
  return [...porEmpresa].map(([organization_id, e]) => ({
    organization_id,
    valor_cents: e.valor,
    vendas: e.vendas.size,
    parcelas: e.parcelas,
  }));
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function textoDoAvisoDeVencidas(v: VencidoDaEmpresa): { titulo: string; corpo: string } {
  const valor = BRL.format(v.valor_cents / 100);
  return {
    titulo: `Parcelas vencidas: ${valor}`,
    corpo:
      `${v.parcelas} ${v.parcelas === 1 ? "parcela vencida" : "parcelas vencidas"} e não recebidas, ` +
      `de ${v.vendas} ${v.vendas === 1 ? "venda" : "vendas"}, somando ${valor}. ` +
      `Cobre o cliente ou dê baixa na parcela. Detalhes em Dashboards › Business › Saúde da carteira.`,
  };
}
