/**
 * O DESTINO DA OPORTUNIDADE DEPOIS DE UMA REUNIÃO SEM VENDA.
 *
 * "Compareceu e não comprou" não diz o que acontece com o negócio — depende do funil: ele pode
 * seguir em negociação, ser desqualificado ou ser dado como perdido. Esta regra olha as etapas do
 * funil da oportunidade e devolve só os destinos que ELE oferece (um funil sem etapa de negociação
 * não oferece "Em negociação"). Quem decide é a pessoa, no diálogo; nada se move sozinho.
 */
export interface EtapaParaODestino {
  id: string;
  name: string;
  slug?: string | null;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  qualification: "mql" | "disqualified" | null;
}

export type TipoDeDestino = "negociacao" | "desqualificado" | "nao_comprou";

export interface OpcaoDeDestino {
  tipo: TipoDeDestino;
  stage_id: string;
  nome: string;
}

const SLUGS_DE_NEGOCIACAO = new Set(["em-negociacao", "em_negociacao", "negociacao"]);

const ehNegociacao = (e: EtapaParaODestino) =>
  SLUGS_DE_NEGOCIACAO.has(e.slug ?? "") || /negocia/i.test(e.name);

export function opcoesDeDestinoPosReuniao(
  etapas: readonly EtapaParaODestino[],
  etapaAtualId: string,
): OpcaoDeDestino[] {
  const ordenadas = [...etapas].sort((a, b) => a.position - b.position);
  const atual = ordenadas.find((e) => e.id === etapaAtualId);
  const opcoes: OpcaoDeDestino[] = [];

  // Negociação: uma etapa ABERTA, adiante da atual (voltar não é "seguir a conversa").
  const negociacao = ordenadas.find(
    (e) =>
      !e.is_won &&
      !e.is_lost &&
      e.qualification !== "disqualified" &&
      ehNegociacao(e) &&
      e.id !== etapaAtualId &&
      (atual === undefined || e.position > atual.position),
  );
  if (negociacao)
    opcoes.push({ tipo: "negociacao", stage_id: negociacao.id, nome: negociacao.name });

  const desqualificado = ordenadas.find((e) => e.qualification === "disqualified" && !e.is_won);
  if (desqualificado) {
    opcoes.push({ tipo: "desqualificado", stage_id: desqualificado.id, nome: desqualificado.name });
  }

  const perdida = ordenadas.find((e) => e.is_lost);
  if (perdida) opcoes.push({ tipo: "nao_comprou", stage_id: perdida.id, nome: perdida.name });

  return opcoes;
}
