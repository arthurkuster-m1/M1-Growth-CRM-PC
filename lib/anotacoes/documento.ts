import { z } from "zod";

/**
 * O DOCUMENTO de uma página de anotação: a lista de blocos do editor (BlockNote), guardada como
 * veio. O servidor não entende cada tipo de bloco — só garante o formato mínimo (cada bloco tem
 * `id` e `type`), o teto de blocos na raiz e, via o banco, o teto de tamanho. Quem desenha e valida
 * o conteúdo de cada bloco é o próprio editor.
 *
 * Páginas antigas, no formato da Estratégia (`tipo`, sem `type`), não casam e abrem em branco.
 */
export const MAXIMO_DE_BLOCOS_NA_RAIZ = 3000;

const blocoDoDocumento = z.looseObject({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(40),
});

export const documentoSchema = z.array(blocoDoDocumento).max(MAXIMO_DE_BLOCOS_NA_RAIZ);

export type BlocoDoDocumento = z.infer<typeof blocoDoDocumento>;
export type Documento = BlocoDoDocumento[];

/** O que veio do banco, só com os blocos que o editor entende (o resto some em vez de quebrar a tela). */
export function lerDocumento(valor: unknown): Documento {
  if (!Array.isArray(valor)) return [];
  const lidos: Documento = [];
  for (const item of valor.slice(0, MAXIMO_DE_BLOCOS_NA_RAIZ)) {
    const r = blocoDoDocumento.safeParse(item);
    if (r.success) lidos.push(r.data);
  }
  return lidos;
}

/** Os ids das subpáginas citadas no documento, na ordem em que aparecem (em qualquer nível). */
export function cartoesDoDocumento(documento: readonly unknown[]): string[] {
  const ids: string[] = [];
  const anda = (blocos: readonly unknown[]) => {
    for (const b of blocos) {
      if (typeof b !== "object" || b === null) continue;
      const bloco = b as { type?: unknown; props?: { pageId?: unknown }; children?: unknown };
      if (bloco.type === "subpagina" && typeof bloco.props?.pageId === "string") {
        ids.push(bloco.props.pageId);
      }
      if (Array.isArray(bloco.children)) anda(bloco.children);
    }
  };
  anda(documento);
  return ids;
}

/**
 * Ajusta as subpáginas do documento ao que existe na árvore: tira cartão de página que não é mais
 * filha daqui (movida, apagada, escondida) e cartão repetido, e acrescenta no fim um cartão para
 * cada filha que ainda não tem. `filhas` já vem na ordem da árvore.
 */
export function ajustarCartoes(documento: Documento, filhas: readonly string[]): Documento {
  const validas = new Set(filhas);
  const vistos = new Set<string>();
  const limpa = (blocos: readonly unknown[]): unknown[] =>
    blocos.flatMap((b) => {
      const bloco = b as BlocoDoDocumento & { props?: { pageId?: unknown }; children?: unknown };
      if (bloco.type === "subpagina") {
        const pageId = bloco.props?.pageId;
        if (typeof pageId !== "string" || !validas.has(pageId) || vistos.has(pageId)) return [];
        vistos.add(pageId);
        return [bloco];
      }
      return Array.isArray(bloco.children)
        ? [{ ...bloco, children: limpa(bloco.children) }]
        : [bloco];
    });
  const base = limpa(documento) as Documento;
  const novos = filhas
    .filter((id) => !vistos.has(id))
    .map((pageId) => ({
      id: `sub-${pageId}`,
      type: "subpagina",
      props: { pageId },
      children: [],
    }));
  return [...base, ...novos];
}
