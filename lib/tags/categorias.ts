/**
 * AS CATEGORIAS DE TAG: cada categoria tem uma cor, e toda tag da categoria herda essa cor
 * (a menos que a própria tag tenha cor escolhida).
 *
 *   Ação        No Show, Remarcou, Compareceu…  (o que aconteceu com o lead)
 *   Tracking    Campanha: …, Ad: …, LP: …, Conjunto: …  (por onde o lead passou)
 *   Funil       Funil: …
 *   Qualificação MQL
 *
 * As quatro já vêm prontas e se reconhecem pelo NOME da tag (regra por prefixo); a organização
 * cria as suas e escolhe a categoria de qualquer tag. Guardado em `organizations.settings`.
 */
import { chaveDaEtiqueta, normalizarCorDeEtiqueta } from "@/lib/tags/cor-da-etiqueta";

export interface CategoriaDeTag {
  id: string;
  nome: string;
  cor: string;
  /** As quatro que já vêm prontas (não se apaga). */
  padrao?: boolean;
}

export interface ConfigDeCategorias {
  categorias: CategoriaDeTag[];
  /** Tag (chave em minúsculas) → id da categoria escolhida à mão. */
  tags: Record<string, string>;
}

export const CATEGORIAS_PADRAO: readonly CategoriaDeTag[] = [
  { id: "acao", nome: "Ação", cor: "#cf3716", padrao: true },
  { id: "tracking", nome: "Tracking", cor: "#3e63dd", padrao: true },
  { id: "funil", nome: "Funil", cor: "#00655a", padrao: true },
  { id: "qualificacao", nome: "Qualificação", cor: "#ab4aba", padrao: true },
];

/** As tags de AÇÃO que o sistema conhece (a forma base, sem o contador "2x"). */
const ACOES_CONHECIDAS = ["no show", "remarcou", "compareceu", "não atendeu", "nao atendeu"];

/** A categoria que o NOME da tag já diz (sem escolha manual). */
export function categoriaPorRegra(tag: string): string | null {
  const t = chaveDaEtiqueta(tag);
  if (/^(campanha|ad|lp|conjunto)\s*:/.test(t)) return "tracking";
  if (/^funil\s*:/.test(t)) return "funil";
  if (t === "mql") return "qualificacao";
  const base = t.replace(/:\s*\d+x$/, "").trim();
  if (ACOES_CONHECIDAS.includes(base)) return "acao";
  return null;
}

/** Lê o que está em `settings` sem quebrar com lixo: as padrão sempre presentes, cores válidas. */
export function lerConfigDeCategorias(settings: unknown): ConfigDeCategorias {
  const bruto =
    settings && typeof settings === "object"
      ? ((settings as Record<string, unknown>).categorias_de_tags as Record<string, unknown> | undefined)
      : undefined;
  const lidas: CategoriaDeTag[] = [];
  if (bruto && Array.isArray(bruto.categorias)) {
    for (const c of bruto.categorias as Array<Record<string, unknown>>) {
      const id = typeof c?.id === "string" ? c.id.slice(0, 40) : "";
      const nome = typeof c?.nome === "string" ? c.nome.trim().slice(0, 40) : "";
      const cor = normalizarCorDeEtiqueta(c?.cor);
      if (id && nome && cor) lidas.push({ id, nome, cor });
    }
  }
  const categorias: CategoriaDeTag[] = CATEGORIAS_PADRAO.map((p) => {
    const mudou = lidas.find((l) => l.id === p.id);
    return mudou ? { ...p, nome: mudou.nome, cor: mudou.cor } : { ...p };
  });
  for (const l of lidas) if (!categorias.some((c) => c.id === l.id)) categorias.push(l);
  // A ordem que a organização guardou (arrastar no popup de ordem) vale; o que não estiver na
  // lista guardada fica no fim, na ordem de fábrica.
  if (lidas.length > 0) {
    const posicao = (id: string) => {
      const i = lidas.findIndex((l) => l.id === id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    categorias.sort((a, b) => posicao(a.id) - posicao(b.id));
  }

  const tags: Record<string, string> = {};
  if (bruto && bruto.tags && typeof bruto.tags === "object") {
    for (const [k, v] of Object.entries(bruto.tags as Record<string, unknown>)) {
      if (typeof v === "string" && categorias.some((c) => c.id === v)) {
        tags[chaveDaEtiqueta(k)] = v;
      }
    }
  }
  return { categorias, tags };
}

/** A categoria da tag: a escolhida à mão, senão a da regra, senão nenhuma. */
export function categoriaDaTag(
  tag: string,
  config: ConfigDeCategorias | null | undefined,
): CategoriaDeTag | null {
  // Tolera quem não tem o provider (testes, telas fora do app): sem config, só a regra pelo nome.
  const manual = config?.tags ?? {};
  const categorias = config?.categorias ?? CATEGORIAS_PADRAO;
  const chave = chaveDaEtiqueta(tag);
  const chaveBase = chave.replace(/:\s*\d+x$/, "").trim();
  const id = manual[chave] ?? manual[chaveBase] ?? categoriaPorRegra(tag);
  return categorias.find((c) => c.id === id) ?? null;
}

/** A cor que a tag ganha da sua categoria, ou `null`. */
export function corDaCategoria(
  tag: string,
  config: ConfigDeCategorias | null | undefined,
): string | null {
  return categoriaDaTag(tag, config)?.cor ?? null;
}

export const CONFIG_VAZIA: ConfigDeCategorias = {
  categorias: CATEGORIAS_PADRAO.map((c) => ({ ...c })),
  tags: {},
};
