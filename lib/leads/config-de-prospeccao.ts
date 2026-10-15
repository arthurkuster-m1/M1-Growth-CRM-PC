import {
  CRITERIOS_PADRAO_DA_FILA,
  RESULTADOS_RAPIDOS,
  type CriteriosDaFila,
  type IdDoResultadoRapido,
} from "@/lib/leads/resultados-rapidos";

/**
 * A CONFIGURAÇÃO da prospecção (fila "Ligar hoje" e modo prospecção). Fica guardada neste
 * navegador, por pessoa: cada vendedor monta a sessão do seu jeito.
 */
export const TIPOS_DE_PROSPECCAO = ["ligacao", "whatsapp", "instagram", "outro"] as const;
export type TipoDeProspeccao = (typeof TIPOS_DE_PROSPECCAO)[number];

export const PROPRIEDADES_DA_PROSPECCAO = [
  "telefone",
  "ligar",
  "whatsapp",
  "instagram",
  "inbox",
  "ficha",
  "tentativas",
  "melhorHorario",
  "proximaAcao",
  "comentarios",
] as const;
export type PropriedadeDaProspeccao = (typeof PROPRIEDADES_DA_PROSPECCAO)[number];

export interface ConfigDaProspeccao {
  fila: CriteriosDaFila;
  /** Quantos leads trabalhar na sessão (0 = a lista toda). */
  quantidade: number;
  tipo: TipoDeProspeccao;
  /** "auto" (a da campanha do lead que combina com o tipo), "nenhuma" ou o id de uma abordagem. */
  abordagemId: string;
  propriedades: Record<PropriedadeDaProspeccao, boolean>;
  atalhos: Record<IdDoResultadoRapido, boolean>;
}

const tudo = <K extends string>(chaves: readonly K[], v: boolean) =>
  Object.fromEntries(chaves.map((k) => [k, v])) as Record<K, boolean>;

/** As propriedades que fazem sentido para cada tipo de prospecção. */
export function propriedadesDoTipo(tipo: TipoDeProspeccao): Record<PropriedadeDaProspeccao, boolean> {
  const base = {
    ...tudo(PROPRIEDADES_DA_PROSPECCAO, false),
    ficha: true,
    tentativas: true,
    proximaAcao: true,
    comentarios: true,
  };
  if (tipo === "ligacao") return { ...base, telefone: true, ligar: true, inbox: true, melhorHorario: true };
  if (tipo === "whatsapp") return { ...base, telefone: true, whatsapp: true, inbox: true };
  if (tipo === "instagram") return { ...base, instagram: true, whatsapp: true };
  return { ...base, telefone: true, ligar: true, whatsapp: true, instagram: true, inbox: true };
}

export const CONFIG_PADRAO_DA_PROSPECCAO: ConfigDaProspeccao = {
  fila: CRITERIOS_PADRAO_DA_FILA,
  quantidade: 0,
  tipo: "ligacao",
  abordagemId: "auto",
  propriedades: propriedadesDoTipo("ligacao"),
  atalhos: tudo(RESULTADOS_RAPIDOS.map((r) => r.id), true),
};

const CHAVE = "m1.prospeccao.config.v1";

export function carregarConfigDaProspeccao(): ConfigDaProspeccao {
  try {
    const bruto = typeof window === "undefined" ? null : window.localStorage.getItem(CHAVE);
    if (!bruto) return CONFIG_PADRAO_DA_PROSPECCAO;
    const o = JSON.parse(bruto) as Partial<ConfigDaProspeccao>;
    const d = CONFIG_PADRAO_DA_PROSPECCAO;
    return {
      fila: { ...d.fila, ...(o.fila ?? {}) },
      quantidade: Number.isFinite(o.quantidade) ? Math.max(0, Number(o.quantidade)) : d.quantidade,
      tipo: TIPOS_DE_PROSPECCAO.includes(o.tipo as TipoDeProspeccao) ? (o.tipo as TipoDeProspeccao) : d.tipo,
      abordagemId: typeof o.abordagemId === "string" ? o.abordagemId : d.abordagemId,
      propriedades: { ...d.propriedades, ...(o.propriedades ?? {}) },
      atalhos: { ...d.atalhos, ...(o.atalhos ?? {}) },
    };
  } catch {
    return CONFIG_PADRAO_DA_PROSPECCAO;
  }
}

export function salvarConfigDaProspeccao(c: ConfigDaProspeccao): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(c));
  } catch {
    /* o navegador pode bloquear: a escolha vale só nesta sessão */
  }
}
