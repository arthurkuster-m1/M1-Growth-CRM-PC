/**
 * A CONFERÊNCIA da importação de leads: o que o servidor diz de cada linha ANTES de gravar
 * (a "Situação da linha" da tabela) e o resumo de tudo, para a pessoa revisar. Só tipos e uma
 * conta simples — o servidor e a tela usam o mesmo formato.
 */
export type TomDaLinha = "ok" | "info" | "aviso" | "erro" | "ign";

export interface SituacaoDaLinha {
  /** A linha como a pessoa a vê no que foi enviado: 1 é o cabeçalho. */
  linha: number;
  tom: TomDaLinha;
  /** A frase da tela: o que vai acontecer com este lead e onde ele entra. */
  texto: string;
  contato?: "novo" | "existente";
  /** "Funil › Etapa" onde o lead entra; vazio quando só fica guardado. */
  destino?: string | null;
  lpNova?: string | null;
  campanhaNova?: string | null;
}

export interface ConferenciaDaImportacao {
  linhas: SituacaoDaLinha[];
}

export interface ResumoDaConferencia {
  prontas: number;
  comAviso: number;
  comErro: number;
  contatosNovos: number;
  contatosAtualizados: number;
  /** Quantos leads entram em cada "Funil › Etapa" (os sem funil ficam em "sem funil"). */
  destinos: Array<{ destino: string | null; quantidade: number }>;
  lpsNovas: string[];
  campanhasNovas: string[];
}

export function resumirConferencia(linhas: SituacaoDaLinha[]): ResumoDaConferencia {
  const r: ResumoDaConferencia = {
    prontas: 0,
    comAviso: 0,
    comErro: 0,
    contatosNovos: 0,
    contatosAtualizados: 0,
    destinos: [],
    lpsNovas: [],
    campanhasNovas: [],
  };
  const porDestino = new Map<string | null, number>();
  for (const l of linhas) {
    if (l.tom === "ign") continue;
    if (l.tom === "erro") {
      r.comErro += 1;
      continue;
    }
    r.prontas += 1;
    if (l.tom === "aviso") r.comAviso += 1;
    if (l.contato === "novo") r.contatosNovos += 1;
    if (l.contato === "existente") r.contatosAtualizados += 1;
    const d = l.destino ?? null;
    porDestino.set(d, (porDestino.get(d) ?? 0) + 1);
    if (l.lpNova && !r.lpsNovas.includes(l.lpNova)) r.lpsNovas.push(l.lpNova);
    if (l.campanhaNova && !r.campanhasNovas.includes(l.campanhaNova)) {
      r.campanhasNovas.push(l.campanhaNova);
    }
  }
  r.destinos = [...porDestino.entries()]
    .map(([destino, quantidade]) => ({ destino, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);
  return r;
}
