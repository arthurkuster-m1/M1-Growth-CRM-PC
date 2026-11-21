/** As ideias e os aprendizados como a tela os vê (e como saem das linhas do banco). Só tipos e mapeadores puros. */
import type { FotoDaCampanha, VereditoSugerido } from "./ideias";

export type StatusDaIdeia = "nova" | "aceita" | "dispensada" | "feita" | "medida";
export type VereditoHumano = "funcionou" | "nao_funcionou" | "inconclusivo";

export interface IdeiaDoGuia {
  id: string;
  regra: string;
  origem: "regra" | "ia" | "manual";
  alvoTipo: "campanha" | "passo" | "geral";
  alvoId: string;
  titulo: string;
  evidencia: string[];
  passoRelacionado: string | null;
  acaoHref: string | null;
  prioridade: 1 | 2 | 3;
  status: StatusDaIdeia;
  motivo: string | null;
  tarefaId: string | null;
  linhaDeBase: FotoDaCampanha | null;
  /** YYYY-MM-DD */
  medirEm: string | null;
  /** A medição de depois: as linhas "antes → depois" e a sugestão do sistema (nunca decide). */
  resultado: { linhas: string[]; sugestao: VereditoSugerido; medidoEm: string } | null;
  veredito: VereditoHumano | null;
  criadaEm: string;
}

export interface AprendizadoDoGuia {
  id: string;
  ideiaId: string | null;
  campanhaId: string | null;
  titulo: string;
  hipotese: string | null;
  resultado: string | null;
  veredito: VereditoHumano;
  criadoEm: string;
}

export const COLUNAS_DA_IDEIA =
  "id,regra,origem,alvo_tipo,alvo_id,titulo,evidencia,passo_relacionado,acao_href,prioridade,status,motivo,task_id,linha_de_base,medir_em,resultado,veredito,created_at";
export const COLUNAS_DO_APRENDIZADO =
  "id,ideia_id,campanha_id,titulo,hipotese,resultado,veredito,created_at";

export function ideiaDaLinha(l: Record<string, unknown>): IdeiaDoGuia {
  const resultado = l.resultado as {
    linhas?: string[];
    sugestao?: VereditoSugerido;
    medidoEm?: string;
  } | null;
  return {
    id: l.id as string,
    regra: l.regra as string,
    origem: l.origem as IdeiaDoGuia["origem"],
    alvoTipo: l.alvo_tipo as IdeiaDoGuia["alvoTipo"],
    alvoId: (l.alvo_id as string) ?? "",
    titulo: l.titulo as string,
    evidencia: Array.isArray(l.evidencia) ? (l.evidencia as string[]) : [],
    passoRelacionado: (l.passo_relacionado as string | null) ?? null,
    acaoHref: (l.acao_href as string | null) ?? null,
    prioridade: (l.prioridade as 1 | 2 | 3) ?? 2,
    status: l.status as StatusDaIdeia,
    motivo: (l.motivo as string | null) ?? null,
    tarefaId: (l.task_id as string | null) ?? null,
    linhaDeBase: (l.linha_de_base as FotoDaCampanha | null) ?? null,
    medirEm: (l.medir_em as string | null) ?? null,
    resultado: resultado
      ? {
          linhas: resultado.linhas ?? [],
          sugestao: resultado.sugestao ?? "inconclusivo",
          medidoEm: resultado.medidoEm ?? "",
        }
      : null,
    veredito: (l.veredito as VereditoHumano | null) ?? null,
    criadaEm: l.created_at as string,
  };
}

export function aprendizadoDaLinha(l: Record<string, unknown>): AprendizadoDoGuia {
  return {
    id: l.id as string,
    ideiaId: (l.ideia_id as string | null) ?? null,
    campanhaId: (l.campanha_id as string | null) ?? null,
    titulo: l.titulo as string,
    hipotese: (l.hipotese as string | null) ?? null,
    resultado: (l.resultado as string | null) ?? null,
    veredito: l.veredito as VereditoHumano,
    criadoEm: l.created_at as string,
  };
}
