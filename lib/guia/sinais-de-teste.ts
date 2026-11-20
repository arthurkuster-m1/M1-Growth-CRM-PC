/** Sinais montados à mão para os testes do Guia. NÃO é importado por código de produto. */
import { chaveDeSubpagina } from "@/lib/marketing/modulos";

import type { Leitura, Sinais } from "./tipos";

const ok = <T>(valor: T): Leitura<T> => ({ ok: true, valor });

/** Empresa recém-criada: tudo lido com sucesso, nada feito. */
export function sinaisVazios(): Sinais {
  return {
    empresa: ok({ temNome: true, temFuso: true }),
    equipe: ok({ membrosAtivos: 1 }),
    paginas: ok({}),
    metaCapi: ok({ existe: false, ativo: false, temDataset: false }),
    landingPages: ok({ total: 0, comUrl: 0 }),
    campanhas: ok({ total: 0, ativas: 0, ativasComMeta: 0, ultimoDiaDaMeta: null }),
    criativos: ok({ total: 0, ultimoCriadoEm: null }),
    abordagens: ok({ total: 0 }),
    leads: ok({ deCampanhaEm30Dias: 0 }),
    vendas: ok({ em90Dias: 0 }),
    whatsapp: ok({ conectados: 0 }),
    funil: ok({ comGanhouEPerdeu: 0 }),
    proximaAcaoPorEtapa: ok({ etapasComPasso: 0 }),
    agenda: ok({ tipos: 0, atendentesComHorario: 0 }),
    googleAgenda: ok({ conectados: 0 }),
    antiNoShow: ok({ fluxos: 0 }),
    respostasRapidas: ok({ total: 0 }),
    cronograma: ok({ itens: 0, ultimaAtividadeEm: null }),
    autoavaliacao: ok({ ultimaEm: null }),
  };
}

/** Todas as páginas da Estratégia publicadas em `publicadaEm`, com 3 concorrentes e 1 de cada subpágina repetível. */
export function paginasPublicadas(publicadaEm: string): Record<string, string | null> {
  const p: Record<string, string | null> = {};
  for (const modulo of [
    "mapeamento-do-funil",
    "posicionamento-zmot",
    "identidade-da-marca",
    "planejamento-empresarial",
  ]) {
    p[modulo] = publicadaEm;
  }
  p[chaveDeSubpagina("estudo-de-persona", "pesquisa-de-mercado")] = publicadaEm;
  p[chaveDeSubpagina("estudo-de-persona", "arquitetura-de-premissas")] = publicadaEm;
  p[chaveDeSubpagina("estudo-de-persona", "persona", "aaaa1")] = publicadaEm;
  for (const id of ["conc1", "conc2", "conc3"]) {
    p[chaveDeSubpagina("analise-de-concorrencia", "concorrente", id)] = publicadaEm;
  }
  p[chaveDeSubpagina("produtos-e-ofertas", "oferta", "ofer1")] = publicadaEm;
  p[chaveDeSubpagina("estrategia-de-marketing", "estrategia", "estr1")] = publicadaEm;
  return p;
}

/** Empresa com tudo que o mapa detecta pronto, no dia `quando`. */
export function sinaisCompletos(quando: string): Sinais {
  return {
    empresa: ok({ temNome: true, temFuso: true }),
    equipe: ok({ membrosAtivos: 3 }),
    paginas: ok(paginasPublicadas(quando)),
    metaCapi: ok({ existe: true, ativo: true, temDataset: true }),
    landingPages: ok({ total: 1, comUrl: 1 }),
    campanhas: ok({ total: 1, ativas: 1, ativasComMeta: 1, ultimoDiaDaMeta: quando.slice(0, 10) }),
    criativos: ok({ total: 4, ultimoCriadoEm: quando }),
    abordagens: ok({ total: 1 }),
    leads: ok({ deCampanhaEm30Dias: 40 }),
    vendas: ok({ em90Dias: 5 }),
    whatsapp: ok({ conectados: 1 }),
    funil: ok({ comGanhouEPerdeu: 1 }),
    proximaAcaoPorEtapa: ok({ etapasComPasso: 3 }),
    agenda: ok({ tipos: 3, atendentesComHorario: 2 }),
    googleAgenda: ok({ conectados: 1 }),
    antiNoShow: ok({ fluxos: 1 }),
    respostasRapidas: ok({ total: 8 }),
    cronograma: ok({ itens: 6, ultimaAtividadeEm: quando }),
    autoavaliacao: ok({ ultimaEm: quando }),
  };
}

/** Toda leitura falhou (banco fora do ar, migration que falta…). */
export function sinaisQueFalharam(motivo = "banco indisponível"): Sinais {
  const f = { ok: false, motivo } as const;
  return Object.fromEntries(Object.keys(sinaisVazios()).map((k) => [k, f])) as unknown as Sinais;
}
