/** Um lote do registro da campanha: uma extração de leads ou uma importação de planilha. */
export interface LoteDaCampanha {
  id: string;
  tipo: "extracao" | "importacao";
  em: string;
  /** Extração: o segmento buscado. Importação: o nome do arquivo. */
  termos: string;
  /** Extração: a cidade ou região. */
  cidade: string | null;
  /** Extração: o limite pedido. */
  limite: number | null;
  /** Extração: quanto o provedor cobrou, em dólar (nulo enquanto roda). */
  custo_usd: number | null;
  /** Extração: o estado da busca. */
  estado: string | null;
  /** Extração: `volume` (máximo de empresas, sem enriquecer) ou `completo`. */
  modo: "completo" | "volume" | null;
  /** Extração: empresas novas na fila. Importação: negócios criados. */
  novos: number;
  /** Extração: empresas que já tínhamos ou foram descartadas. Importação: contatos que já existiam. */
  repetidos: number;
  /** Importação: linhas recusadas. */
  invalidos: number;
  /** Importação: linhas da planilha. */
  linhas: number | null;
}
