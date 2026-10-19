import {
  CRITERIOS_PADRAO_DA_FILA,
  RESULTADOS_RAPIDOS,
  type CriteriosDaFila,
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

/**
 * Um botão de resultado do modo prospecção (atalhos 1, 2, 3… pela ordem dos ativos). Cada tipo de
 * prospecção tem a SUA lista: "Caixa postal" não faz sentido no WhatsApp.
 */
export interface ResultadoDaProspeccao {
  id: string;
  /** O texto do botão. */
  rotulo: string;
  ativo: boolean;
  /** O que fica gravado no histórico (vazio = o próprio rótulo). */
  resultado?: string;
  /** O próximo passo marcado automaticamente (texto) e em quantos dias úteis. */
  proximo?: string;
  diasUteis?: number;
  /** Pergunta a data do retorno em vez de usar dias úteis. */
  pedeData?: boolean;
  /** Pede o que foi conversado (obrigatório). */
  exigeComentario?: boolean;
  /** Encerra a oportunidade como perdida (pede o motivo). */
  perde?: boolean;
}

export interface ConfigDaProspeccao {
  fila: CriteriosDaFila;
  /** Quantos leads trabalhar na sessão (0 = a lista toda). */
  quantidade: number;
  tipo: TipoDeProspeccao;
  /** "auto" (a da campanha do lead que combina com o tipo), "nenhuma" ou o id de uma abordagem. */
  abordagemId: string;
  propriedades: Record<PropriedadeDaProspeccao, boolean>;
  resultadosPorTipo: Record<TipoDeProspeccao, ResultadoDaProspeccao[]>;
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

const dosPadroes = (): ResultadoDaProspeccao[] =>
  RESULTADOS_RAPIDOS.map((r) => ({ ...r, ativo: true }) as ResultadoDaProspeccao);

/** Os resultados de partida de cada tipo (o usuário muda à vontade na configuração). */
export function resultadosPadraoDoTipo(tipo: TipoDeProspeccao): ResultadoDaProspeccao[] {
  if (tipo === "whatsapp") {
    return [
      { id: "sem_resposta", rotulo: "Sem resposta", ativo: true, proximo: "Chamar de novo no WhatsApp", diasUteis: 1 },
      { id: "sem_whatsapp", rotulo: "Sem WhatsApp", ativo: true, proximo: "Conferir o telefone do lead", diasUteis: 0 },
      { id: "conversa", rotulo: "Respondeu", ativo: true, resultado: "Respondeu — conversa positiva", proximo: "Seguir o combinado na conversa", diasUteis: 1, exigeComentario: true },
      { id: "retornar", rotulo: "Pediu retorno", ativo: true, resultado: "Respondeu — pediu para retornar", proximo: "Retornar a conversa", pedeData: true, exigeComentario: true },
      { id: "sem_interesse", rotulo: "Sem interesse", ativo: true, resultado: "Respondeu — sem interesse", perde: true, exigeComentario: true },
    ];
  }
  if (tipo === "instagram") {
    return [
      { id: "dm_enviada", rotulo: "Mensagem enviada", ativo: true, proximo: "Ver se respondeu no Instagram", diasUteis: 2 },
      { id: "conversa", rotulo: "Respondeu", ativo: true, resultado: "Respondeu — conversa positiva", proximo: "Seguir o combinado na conversa", diasUteis: 1, exigeComentario: true },
      { id: "retornar", rotulo: "Pediu retorno", ativo: true, resultado: "Respondeu — pediu para retornar", proximo: "Retornar a conversa", pedeData: true, exigeComentario: true },
      { id: "sem_interesse", rotulo: "Sem interesse", ativo: true, resultado: "Respondeu — sem interesse", perde: true, exigeComentario: true },
    ];
  }
  return dosPadroes();
}

/** Os botões de resultado ATIVOS do tipo em uso, na ordem dos atalhos. */
export function resultadosAtivosDaConfig(c: ConfigDaProspeccao): ResultadoDaProspeccao[] {
  return (c.resultadosPorTipo[c.tipo] ?? []).filter((r) => r.ativo && r.rotulo.trim() !== "");
}

const resultadosDeFabrica = (): Record<TipoDeProspeccao, ResultadoDaProspeccao[]> => ({
  ligacao: resultadosPadraoDoTipo("ligacao"),
  whatsapp: resultadosPadraoDoTipo("whatsapp"),
  instagram: resultadosPadraoDoTipo("instagram"),
  outro: resultadosPadraoDoTipo("outro"),
});

export const CONFIG_PADRAO_DA_PROSPECCAO: ConfigDaProspeccao = {
  fila: CRITERIOS_PADRAO_DA_FILA,
  quantidade: 0,
  tipo: "ligacao",
  abordagemId: "auto",
  propriedades: propriedadesDoTipo("ligacao"),
  resultadosPorTipo: resultadosDeFabrica(),
};

const CHAVE = "m1.prospeccao.config.v1";

export function carregarConfigDaProspeccao(): ConfigDaProspeccao {
  try {
    const bruto = typeof window === "undefined" ? null : window.localStorage.getItem(CHAVE);
    if (!bruto) return CONFIG_PADRAO_DA_PROSPECCAO;
    const o = JSON.parse(bruto) as Partial<ConfigDaProspeccao>;
    const d = CONFIG_PADRAO_DA_PROSPECCAO;
    const antigo = (o as { atalhos?: Record<string, boolean> }).atalhos;
    const guardados = o.resultadosPorTipo;
    const resultadosPorTipo = resultadosDeFabrica();
    for (const tipo of TIPOS_DE_PROSPECCAO) {
      const lista = guardados?.[tipo];
      if (Array.isArray(lista)) {
        resultadosPorTipo[tipo] = lista.filter(
          (r): r is ResultadoDaProspeccao => Boolean(r) && typeof r.id === "string" && typeof r.rotulo === "string",
        );
      } else if (antigo && (tipo === "ligacao" || tipo === "outro")) {
        // Versão anterior: só ligava e desligava os seis botões fixos.
        resultadosPorTipo[tipo] = resultadosPorTipo[tipo].map((r) => ({ ...r, ativo: antigo[r.id] !== false }));
      }
    }
    return {
      fila: { ...d.fila, ...(o.fila ?? {}) },
      quantidade: Number.isFinite(o.quantidade) ? Math.max(0, Number(o.quantidade)) : d.quantidade,
      tipo: TIPOS_DE_PROSPECCAO.includes(o.tipo as TipoDeProspeccao) ? (o.tipo as TipoDeProspeccao) : d.tipo,
      abordagemId: typeof o.abordagemId === "string" ? o.abordagemId : d.abordagemId,
      propriedades: { ...d.propriedades, ...(o.propriedades ?? {}) },
      resultadosPorTipo,
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
