/**
 * As CONTAS de uma linha de tráfego (um dia, uma campanha, um anúncio, uma página, um canal):
 * a mesma régua em todas as tabelas do dashboard. Tudo parte de números brutos; as taxas são
 * derivadas aqui, uma vez, e `null` quer dizer "sem base para a conta" (aparece como "—").
 */
export interface BrutoDeTrafego {
  impressoes: number;
  alcance?: number;
  cliques: number;
  viewsLP: number;
  leads: number;
  vendas: number;
  investimento: number;
  recebido: number;
  desqualificados?: number;
}

export interface DerivadasDeTrafego extends BrutoDeTrafego {
  cpm: number | null;
  ctr: number | null;
  cpc: number | null;
  connect: number | null;
  convLP: number | null;
  cpl: number | null;
  /** Vendas ÷ leads, em %. */
  convVenda: number | null;
  cac: number | null;
  cpVisitaLP: number | null;
  frequencia: number | null;
  lucro: number;
  roas: number | null;
  taxaDesq: number | null;
}

const razao = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/**
 * `semMidia`: a linha não tem entrega nem gasto próprios (uma landing page de campanha com várias
 * páginas, ou um canal não conectado). As contas que dependem deles ficam `null`, em vez de um
 * zero que pareceria dado.
 */
export function derivarTrafego(b: BrutoDeTrafego, semMidia = false): DerivadasDeTrafego {
  const m = (v: number | null) => (semMidia ? null : v);
  return {
    ...b,
    cpm: m(razao(b.investimento * 1000, b.impressoes)),
    ctr: m(razao(b.cliques * 100, b.impressoes)),
    cpc: m(razao(b.investimento, b.cliques)),
    connect: m(razao(b.viewsLP * 100, b.cliques)),
    convLP: m(razao(b.leads * 100, b.viewsLP)),
    cpl: m(razao(b.investimento, b.leads)),
    convVenda: razao(b.vendas * 100, b.leads),
    cac: m(razao(b.investimento, b.vendas)),
    cpVisitaLP: m(razao(b.investimento, b.viewsLP)),
    frequencia: m(razao(b.impressoes, b.alcance ?? 0)),
    lucro: b.recebido - (semMidia ? 0 : b.investimento),
    roas: m(razao(b.recebido, b.investimento)),
    taxaDesq: razao((b.desqualificados ?? 0) * 100, b.leads),
  };
}

const ZERO: BrutoDeTrafego = {
  impressoes: 0,
  alcance: 0,
  cliques: 0,
  viewsLP: 0,
  leads: 0,
  vendas: 0,
  investimento: 0,
  recebido: 0,
  desqualificados: 0,
};

/** Soma de várias linhas brutas (o rodapé de uma tabela). */
export function somarBrutos(linhas: readonly BrutoDeTrafego[]): BrutoDeTrafego {
  const s = { ...ZERO };
  for (const l of linhas) {
    s.impressoes += l.impressoes;
    s.alcance = (s.alcance ?? 0) + (l.alcance ?? 0);
    s.cliques += l.cliques;
    s.viewsLP += l.viewsLP;
    s.leads += l.leads;
    s.vendas += l.vendas;
    s.investimento += l.investimento;
    s.recebido += l.recebido;
    s.desqualificados = (s.desqualificados ?? 0) + (l.desqualificados ?? 0);
  }
  return s;
}
