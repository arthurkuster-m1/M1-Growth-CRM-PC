import { ROTEIRO_DE_VENDAS, modeloDoAtendimento, type ModeloDeAtendimento } from "@/lib/agenda/atendimentos";

/**
 * A PÁGINA DE ATENDIMENTO de cada tipo de compromisso: qual modelo abre, quais blocos aparecem e o
 * roteiro (passos com dica) que o atendente segue. Mora em `organizations.settings.atendimento_por_tipo`,
 * por tipo; sem configuração, vale o padrão do modelo (reunião de vendas ou atendimento simples).
 */
export interface PassoDoRoteiro {
  titulo: string;
  dica: string;
}

export interface BlocosDoAtendimento {
  /** O roteiro com passos para marcar. */
  roteiro: boolean;
  /** O espaço de anotações do atendimento. */
  anotacoes: boolean;
  /** A oportunidade, a venda e as parcelas dentro do compromisso. */
  oportunidade: boolean;
  /** As recomendações da IA ao vivo (em breve). */
  ia: boolean;
}

export interface ModeloDeAtendimentoDoTipo {
  modelo: ModeloDeAtendimento;
  blocos: BlocosDoAtendimento;
  roteiro: PassoDoRoteiro[];
}

export const LIMITE_DE_PASSOS = 20;

export function padraoDoModelo(modelo: ModeloDeAtendimento): ModeloDeAtendimentoDoTipo {
  return modelo === "vendas"
    ? {
        modelo,
        blocos: { roteiro: true, anotacoes: true, oportunidade: true, ia: true },
        roteiro: ROTEIRO_DE_VENDAS.map((p) => ({ ...p })),
      }
    : {
        modelo,
        blocos: { roteiro: false, anotacoes: true, oportunidade: true, ia: false },
        roteiro: [],
      };
}

const texto = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Lê o que está gravado (JSON solto) e devolve um modelo bem formado, ou o padrão do tipo. */
export function lerModeloDoTipo(
  bruto: unknown,
  tipo: { nome?: string | null; slug?: string | null },
): ModeloDeAtendimentoDoTipo {
  const sugerido = modeloDoAtendimento(tipo);
  if (!bruto || typeof bruto !== "object") return padraoDoModelo(sugerido);
  const b = bruto as Record<string, unknown>;
  const modelo: ModeloDeAtendimento = b.modelo === "vendas" || b.modelo === "padrao" ? b.modelo : sugerido;
  const base = padraoDoModelo(modelo);
  const bl = (b.blocos && typeof b.blocos === "object" ? b.blocos : {}) as Record<string, unknown>;
  const flag = (k: keyof BlocosDoAtendimento) => (typeof bl[k] === "boolean" ? (bl[k] as boolean) : base.blocos[k]);
  const passos = Array.isArray(b.roteiro)
    ? (b.roteiro as unknown[])
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return { titulo: texto(o.titulo, 80), dica: texto(o.dica, 300) };
        })
        .filter((p) => p.titulo !== "")
        .slice(0, LIMITE_DE_PASSOS)
    : base.roteiro;
  return {
    modelo,
    blocos: { roteiro: flag("roteiro"), anotacoes: flag("anotacoes"), oportunidade: flag("oportunidade"), ia: flag("ia") },
    roteiro: passos,
  };
}
