/**
 * AS ANÁLISES da Agenda: compromissos, comparecimento e conversão. Conta pura, sem banco: a rota
 * lê e esta função agrega — o mesmo número vale na tela, nos dashboards e nos testes.
 *
 * Regras:
 *  - "Agendados" = todo compromisso com início no período (qualquer situação).
 *  - "Compareceram" e "Faltaram" são declarações HUMANAS (nunca presumidas).
 *  - "Sem desfecho" = já terminou e ninguém declarou compareceu/faltou (é o que a equipe precisa fechar).
 *  - Taxa de comparecimento = compareceram ÷ (compareceram + faltaram): só entra quem teve desfecho.
 *  - Conversão = dos que compareceram e tinham oportunidade, quantos já tiveram venda (1ª parcela recebida).
 */
export interface CompromissoParaAnalise {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  starts_at: string;
  ends_at: string;
  owner_user_id: string | null;
  event_type_id: string | null;
  lead_id: string | null;
  campaign_id: string | null;
  /** A oportunidade deste compromisso já vendeu. */
  vendeu: boolean;
}

export interface TotaisDaAgenda {
  agendados: number;
  compareceram: number;
  faltaram: number;
  cancelados: number;
  semDesfecho: number;
  proximos: number;
  comOportunidade: number;
  /** Compareceram que têm oportunidade e vendeu. */
  convertidos: number;
  /** compareceram ÷ (compareceram + faltaram), em %, ou null sem desfecho. */
  taxaDeComparecimento: number | null;
  /** convertidos ÷ compareceram com oportunidade, em %, ou null. */
  taxaDeConversao: number | null;
}

export interface GrupoDaAgenda extends TotaisDaAgenda {
  id: string;
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

function totaisDe(lista: readonly CompromissoParaAnalise[], agora: number): TotaisDaAgenda {
  const t = {
    agendados: lista.length,
    compareceram: 0,
    faltaram: 0,
    cancelados: 0,
    semDesfecho: 0,
    proximos: 0,
    comOportunidade: 0,
    convertidos: 0,
  };
  let compareceramComOportunidade = 0;
  for (const c of lista) {
    if (c.lead_id) t.comOportunidade += 1;
    if (c.status === "completed") {
      t.compareceram += 1;
      if (c.lead_id) {
        compareceramComOportunidade += 1;
        if (c.vendeu) t.convertidos += 1;
      }
    } else if (c.status === "no_show") t.faltaram += 1;
    else if (c.status === "cancelled") t.cancelados += 1;
    else if (Date.parse(c.ends_at) < agora) t.semDesfecho += 1;
    else t.proximos += 1;
  }
  return {
    ...t,
    taxaDeComparecimento: pct(t.compareceram, t.compareceram + t.faltaram),
    taxaDeConversao: pct(t.convertidos, compareceramComOportunidade),
  };
}

function agrupar(
  lista: readonly CompromissoParaAnalise[],
  chave: (c: CompromissoParaAnalise) => string | null,
  agora: number,
): GrupoDaAgenda[] {
  const mapa = new Map<string, CompromissoParaAnalise[]>();
  for (const c of lista) {
    const k = chave(c) ?? "";
    mapa.set(k, [...(mapa.get(k) ?? []), c]);
  }
  return [...mapa.entries()]
    .map(([id, itens]) => ({ id, ...totaisDe(itens, agora) }))
    .sort((a, b) => b.agendados - a.agendados);
}

export interface AnalisesDaAgenda {
  totais: TotaisDaAgenda;
  porAtendente: GrupoDaAgenda[];
  porTipo: GrupoDaAgenda[];
  porCampanha: GrupoDaAgenda[];
  porDia: Array<{ dia: string; agendados: number; compareceram: number; faltaram: number }>;
}

export function analisarCompromissos(
  lista: readonly CompromissoParaAnalise[],
  diaDe: (instante: string) => string,
  agora: number = Date.now(),
): AnalisesDaAgenda {
  const porDia = new Map<string, { agendados: number; compareceram: number; faltaram: number }>();
  for (const c of lista) {
    const d = diaDe(c.starts_at);
    const v = porDia.get(d) ?? { agendados: 0, compareceram: 0, faltaram: 0 };
    v.agendados += 1;
    if (c.status === "completed") v.compareceram += 1;
    if (c.status === "no_show") v.faltaram += 1;
    porDia.set(d, v);
  }
  return {
    totais: totaisDe(lista, agora),
    porAtendente: agrupar(lista, (c) => c.owner_user_id, agora),
    porTipo: agrupar(lista, (c) => c.event_type_id, agora),
    porCampanha: agrupar(lista, (c) => c.campaign_id, agora),
    porDia: [...porDia.entries()]
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}
