import {
  ROTEIRO_DE_VENDAS,
  modeloDoAtendimento,
  type ModeloDeAtendimento,
} from "@/lib/agenda/atendimentos";
import { blocosSchema, type Bloco } from "@/lib/marketing/blocos";

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
  /**
   * O MODELO DE BLOCOS do tipo: o que o editor da página do compromisso traz já preenchido (cada
   * compromisso pode adaptá-lo só para si). Ausente = deriva-se do roteiro (`blocosDoModelo`).
   */
  blocos_do_modelo?: Bloco[];
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

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Lê o que está gravado (JSON solto) e devolve um modelo bem formado, ou o padrão do tipo. */
export function lerModeloDoTipo(
  bruto: unknown,
  tipo: { nome?: string | null; slug?: string | null },
): ModeloDeAtendimentoDoTipo {
  const sugerido = modeloDoAtendimento(tipo);
  if (!bruto || typeof bruto !== "object") return padraoDoModelo(sugerido);
  const b = bruto as Record<string, unknown>;
  const modelo: ModeloDeAtendimento =
    b.modelo === "vendas" || b.modelo === "padrao" ? b.modelo : sugerido;
  const base = padraoDoModelo(modelo);
  const bl = (b.blocos && typeof b.blocos === "object" ? b.blocos : {}) as Record<string, unknown>;
  const flag = (k: keyof BlocosDoAtendimento) =>
    typeof bl[k] === "boolean" ? (bl[k] as boolean) : base.blocos[k];
  const passos = Array.isArray(b.roteiro)
    ? (b.roteiro as unknown[])
        .map((p) => {
          const o = (p ?? {}) as Record<string, unknown>;
          return { titulo: texto(o.titulo, 80), dica: texto(o.dica, 300) };
        })
        .filter((p) => p.titulo !== "")
        .slice(0, LIMITE_DE_PASSOS)
    : base.roteiro;
  const doModelo = blocosSchema.safeParse(b.blocos_do_modelo);
  return {
    modelo,
    blocos: {
      roteiro: flag("roteiro"),
      anotacoes: flag("anotacoes"),
      oportunidade: flag("oportunidade"),
      ia: flag("ia"),
    },
    roteiro: passos,
    ...(doModelo.success ? { blocos_do_modelo: doModelo.data } : {}),
  };
}

/**
 * Os blocos com que a página do compromisso ABRE: o modelo de blocos do tipo e, sem ele, um que sai do
 * roteiro (cada passo vira um título com a dica, e um espaço para escrever) ou, no atendimento
 * simples, um espaço de anotações. `novoId` cria os ids dos blocos.
 */
export function blocosDoModelo(cfg: ModeloDeAtendimentoDoTipo, novoId: () => string): Bloco[] {
  if (cfg.blocos_do_modelo) return cfg.blocos_do_modelo;
  const blocos: Bloco[] = [];
  if (cfg.blocos.roteiro) {
    for (const passo of cfg.roteiro) {
      blocos.push({ id: novoId(), tipo: "titulo", nivel: 2, texto: passo.titulo } as Bloco);
      if (passo.dica) blocos.push({ id: novoId(), tipo: "texto", texto: passo.dica } as Bloco);
      blocos.push({ id: novoId(), tipo: "texto", texto: "" } as Bloco);
    }
  }
  if (cfg.blocos.anotacoes || blocos.length === 0) {
    blocos.push({ id: novoId(), tipo: "titulo", nivel: 2, texto: "Anotações" } as Bloco);
    blocos.push({ id: novoId(), tipo: "texto", texto: "" } as Bloco);
  }
  return blocos;
}
