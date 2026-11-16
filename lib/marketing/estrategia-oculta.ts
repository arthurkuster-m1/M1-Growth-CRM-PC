/**
 * O QUE SE PODE OCULTAR na aba Estratégia — e o que nunca se oculta.
 *
 * Nem toda página faz sentido para todo cliente (depende do pacote). A agência oculta fases
 * inteiras (01 Diagnóstico, 02 Mercado e Oferta, 03 Geração de Demanda), páginas e os atalhos do
 * topo, e traz de volta quando precisar. A ÚNICA coisa que não se oculta é "Produtos e ofertas":
 * é por ela que o CRM vende. Puro.
 *
 * As chaves guardadas (migration 0691): `fase:<fase>`, `<módulo>` e `atalho:<módulo>`.
 */
import {
  FASES_DA_ESTRATEGIA,
  MODULOS_DA_ESTRATEGIA,
  type FaseDaEstrategia,
} from "@/lib/marketing/modulos";

/** O módulo que sustenta as vendas do CRM: nunca se oculta nem se apaga. */
export const MODULO_ESSENCIAL = "produtos-e-ofertas";

/** Os atalhos do topo da aba (cada um leva a uma página de módulo). */
export const ATALHOS_DA_ESTRATEGIA = [
  "estudo-de-persona",
  "posicionamento-zmot",
  "analise-de-concorrencia",
] as const;
export type AtalhoDaEstrategia = (typeof ATALHOS_DA_ESTRATEGIA)[number];

export const chaveDaFase = (fase: FaseDaEstrategia): string => `fase:${fase}`;
export const chaveDoAtalho = (atalho: AtalhoDaEstrategia): string => `atalho:${atalho}`;

export type TipoDeItemOculto = "fase" | "pagina" | "atalho";

/** Lê uma chave guardada; `null` se não é de nada que exista (ou é o módulo essencial). */
export function lerChaveOculta(chave: string): { tipo: TipoDeItemOculto; alvo: string } | null {
  if (chave.startsWith("fase:")) {
    const fase = chave.slice(5);
    return (FASES_DA_ESTRATEGIA as readonly string[]).includes(fase)
      ? { tipo: "fase", alvo: fase }
      : null;
  }
  if (chave.startsWith("atalho:")) {
    const a = chave.slice(7);
    return (ATALHOS_DA_ESTRATEGIA as readonly string[]).includes(a)
      ? { tipo: "atalho", alvo: a }
      : null;
  }
  if (chave === MODULO_ESSENCIAL) return null;
  return MODULOS_DA_ESTRATEGIA.some((m) => m.chave === chave && !m.semPagina)
    ? { tipo: "pagina", alvo: chave }
    : null;
}

/** As páginas (módulos) de uma fase que podem ser ocultadas/apagadas — sem o essencial. */
export const paginasOcultaveisDaFase = (fase: FaseDaEstrategia): string[] =>
  MODULOS_DA_ESTRATEGIA.filter((m) => m.fase === fase && m.chave !== MODULO_ESSENCIAL).map(
    (m) => m.chave,
  );

/**
 * As chaves de página (`marketing_pages.module_key`) que "apagar" leva: a página do módulo e
 * todas as subpáginas dela (personas, concorrentes, estratégias…). Para uma fase, as de todos os
 * módulos dela — nunca as do módulo essencial.
 */
export function chavesDePaginaParaApagar(chave: string): string[] {
  const l = lerChaveOculta(chave);
  if (!l || l.tipo === "atalho") return [];
  if (l.tipo === "pagina") return [l.alvo];
  return paginasOcultaveisDaFase(l.alvo as FaseDaEstrategia);
}

/** O conjunto de itens ocultos, com as perguntas que a página faz. */
export class OcultosDaEstrategia {
  constructor(private readonly chaves: ReadonlySet<string>) {}

  fase = (fase: FaseDaEstrategia) => this.chaves.has(chaveDaFase(fase));
  /** A página some se ela mesma foi ocultada. (Ocultar a fase esconde a galeria, não as chaves.) */
  pagina = (chave: string) => chave !== MODULO_ESSENCIAL && this.chaves.has(chave);
  atalho = (a: AtalhoDaEstrategia) => this.chaves.has(chaveDoAtalho(a));
  get todas(): string[] {
    return [...this.chaves];
  }
}
