/**
 * DE ONDE VIERAM OS LEADS DE UMA CAMPANHA — a conta pura (testada à parte).
 *
 * Entra a lista de leads (já com a origem gravada na entrada) e sai a contagem por criativo, por
 * landing page e por conjunto de anúncios, mais a fatia "sem origem identificada". Conta
 * CONTATOS distintos (a mesma pessoa que preencheu e depois chamou no WhatsApp é um lead só).
 */
export interface LeadDaOrigem {
  contato: string;
  criativoId: string | null;
  landingPageId: string | null;
  /** Do `utm_term` (formulário) ou do cache da hierarquia do anúncio (WhatsApp). */
  conjuntoId: string | null;
  conjuntoNome: string | null;
}

export interface ContagemDaOrigem {
  total: number;
  porCriativo: Record<string, number>;
  porLandingPage: Record<string, number>;
  porConjunto: Array<{ id: string; nome: string | null; leads: number }>;
  semCriativo: number;
  semLandingPage: number;
  semConjunto: number;
}

export function contarOrigemDosLeads(leads: readonly LeadDaOrigem[]): ContagemDaOrigem {
  const vistos = {
    todos: new Set<string>(),
    criativo: new Map<string, Set<string>>(),
    lp: new Map<string, Set<string>>(),
    conjunto: new Map<string, { nome: string | null; pessoas: Set<string> }>(),
    semCriativo: new Set<string>(),
    semLp: new Set<string>(),
    semConjunto: new Set<string>(),
  };
  const poe = (m: Map<string, Set<string>>, k: string, v: string) => {
    const s = m.get(k) ?? new Set<string>();
    s.add(v);
    m.set(k, s);
  };
  for (const l of leads) {
    vistos.todos.add(l.contato);
    if (l.criativoId) poe(vistos.criativo, l.criativoId, l.contato);
    else vistos.semCriativo.add(l.contato);
    if (l.landingPageId) poe(vistos.lp, l.landingPageId, l.contato);
    else vistos.semLp.add(l.contato);
    if (l.conjuntoId) {
      const atual = vistos.conjunto.get(l.conjuntoId) ?? {
        nome: l.conjuntoNome,
        pessoas: new Set(),
      };
      atual.nome = atual.nome ?? l.conjuntoNome;
      atual.pessoas.add(l.contato);
      vistos.conjunto.set(l.conjuntoId, atual);
    } else vistos.semConjunto.add(l.contato);
  }
  const tam = (m: Map<string, Set<string>>) =>
    Object.fromEntries([...m].map(([k, v]) => [k, v.size]));
  return {
    total: vistos.todos.size,
    porCriativo: tam(vistos.criativo),
    porLandingPage: tam(vistos.lp),
    porConjunto: [...vistos.conjunto]
      .map(([id, v]) => ({ id, nome: v.nome, leads: v.pessoas.size }))
      .sort((a, b) => b.leads - a.leads),
    semCriativo: vistos.semCriativo.size,
    semLandingPage: vistos.semLp.size,
    semConjunto: vistos.semConjunto.size,
  };
}
