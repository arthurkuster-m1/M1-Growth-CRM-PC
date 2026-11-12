import { z } from "zod";

import { documentoSchema, type Documento } from "@/lib/anotacoes/documento";

/** O teto de subpáginas, uma dentro da outra (o banco também recusa). */
export const PROFUNDIDADE_MAXIMA = 12;
export const MAXIMO_DE_PAGINAS = 2000;

/** Uma página da árvore (sem o conteúdo: a lista só precisa do necessário para desenhar a lateral). */
export interface ResumoDaNota {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  position: number;
  visible_to_client: boolean;
  deleted_at: string | null;
  updated_at: string;
}

/** Uma página aberta, com o conteúdo. */
export interface NotaAberta extends ResumoDaNota {
  blocks: Documento;
}

export const COLUNAS_DO_RESUMO =
  "id, parent_id, title, icon, position, visible_to_client, deleted_at, updated_at";
export const COLUNAS_DA_NOTA = `${COLUNAS_DO_RESUMO}, blocks`;

const tituloSchema = z.string().trim().max(200);
const iconeSchema = z.string().trim().max(16).nullable();
const idSchema = z.string().uuid();

export const novaNotaSchema = z.object({
  parent_id: idSchema.nullable().default(null),
  title: tituloSchema.default(""),
  /** Posição entre as irmãs; omitida = vai para o fim. */
  position: z.number().finite().optional(),
});

/** Editar: qualquer subconjunto. `cascade` só vale com `visible_to_client`. */
export const edicaoDeNotaSchema = z
  .object({
    title: tituloSchema,
    icon: iconeSchema,
    blocks: documentoSchema,
    parent_id: idSchema.nullable(),
    position: z.number().finite(),
    visible_to_client: z.boolean(),
    cascade: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

export const idDeNotaSchema = idSchema;

/** Resultado de desenhar a árvore: cada nó com as filhas já em ordem. */
export interface NoDaArvore {
  nota: ResumoDaNota;
  filhas: NoDaArvore[];
}

function porPosicao(a: ResumoDaNota, b: ResumoDaNota): number {
  return a.position - b.position || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

/**
 * Monta a árvore. Uma página cuja mãe não está na lista (apagada, ou escondida do cliente) vira raiz:
 * quem só enxerga parte da árvore ainda acha as páginas que pode ler.
 */
export function montarArvore(notas: readonly ResumoDaNota[]): NoDaArvore[] {
  const ids = new Set(notas.map((n) => n.id));
  const filhasDe = new Map<string | null, ResumoDaNota[]>();
  for (const n of notas) {
    const chave = n.parent_id && ids.has(n.parent_id) ? n.parent_id : null;
    filhasDe.set(chave, [...(filhasDe.get(chave) ?? []), n]);
  }
  const desce = (pai: string | null, vistos: Set<string>): NoDaArvore[] =>
    (filhasDe.get(pai) ?? [])
      .slice()
      .sort(porPosicao)
      .filter((n) => !vistos.has(n.id))
      .map((n) => ({ nota: n, filhas: desce(n.id, new Set([...vistos, n.id])) }));
  return desce(null, new Set());
}

/** A página e todas as que estão dentro dela, em qualquer nível. */
export function idsDaSubarvore(notas: readonly ResumoDaNota[], raiz: string): string[] {
  const resultado = [raiz];
  const visto = new Set(resultado);
  for (let i = 0; i < resultado.length; i++) {
    for (const n of notas) {
      if (n.parent_id === resultado[i] && !visto.has(n.id)) {
        visto.add(n.id);
        resultado.push(n.id);
      }
    }
  }
  return resultado;
}

/** O caminho da raiz até a página (inclui ela), para o "migalha de pão". */
export function caminhoDaNota(notas: readonly ResumoDaNota[], id: string): ResumoDaNota[] {
  const porId = new Map(notas.map((n) => [n.id, n]));
  const caminho: ResumoDaNota[] = [];
  const visto = new Set<string>();
  let atual = porId.get(id);
  while (atual && !visto.has(atual.id)) {
    visto.add(atual.id);
    caminho.unshift(atual);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return caminho;
}

/** A página `id` fica dentro de `ancestral` (ou é ela mesma)? Para recusar mover para dentro de si. */
export function estaDentroDe(
  notas: readonly ResumoDaNota[],
  id: string,
  ancestral: string,
): boolean {
  return idsDaSubarvore(notas, ancestral).includes(id);
}

/** Quantos níveis a subárvore de `raiz` tem (1 = só ela). Para o teto de profundidade ao mover. */
export function alturaDaSubarvore(notas: readonly ResumoDaNota[], raiz: string): number {
  const filhasDe = new Map<string, string[]>();
  for (const n of notas) {
    if (n.parent_id) filhasDe.set(n.parent_id, [...(filhasDe.get(n.parent_id) ?? []), n.id]);
  }
  const desce = (id: string, vistos: Set<string>): number => {
    let maior = 0;
    for (const f of filhasDe.get(id) ?? []) {
      if (!vistos.has(f)) maior = Math.max(maior, desce(f, new Set([...vistos, f])));
    }
    return maior + 1;
  };
  return desce(raiz, new Set([raiz]));
}

/** Quantos níveis acima de `id` existem (raiz = 1). */
export function profundidadeDaNota(notas: readonly ResumoDaNota[], id: string): number {
  return caminhoDaNota(notas, id).length;
}
