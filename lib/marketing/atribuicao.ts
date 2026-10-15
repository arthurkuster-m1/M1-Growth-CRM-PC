/**
 * DE QUEM É A OPORTUNIDADE: leads e faturamento vão para a campanha DONA DO FUNIL em que a
 * oportunidade está. A campanha de ORIGEM (por onde a pessoa entrou) fica registrada na origem e
 * nas tags, mas só recebe o dinheiro quando o funil não pertence a nenhuma campanha.
 *
 * Exemplo: o lead entrou pela campanha de tráfego A, não comprou e foi reaproveitado numa
 * campanha de reativação R. A oportunidade nova está no funil de R (e herda a origem A): o
 * faturamento é de R e a campanha A, que já rodou, não é inflada. É a mesma regra do banco
 * (`fn_campanha_da_oportunidade`, migration 0641).
 */
export interface CampanhaDoFunil {
  id: string;
  pipeline_id: string | null;
}

export function campanhaDaOportunidade(
  oportunidade: { pipeline_id: string | null; demand_campaign_id: string | null },
  campanhas: readonly CampanhaDoFunil[],
): string | null {
  if (oportunidade.pipeline_id) {
    const dona = campanhas.find((c) => c.pipeline_id === oportunidade.pipeline_id);
    if (dona) return dona.id;
  }
  return oportunidade.demand_campaign_id;
}
