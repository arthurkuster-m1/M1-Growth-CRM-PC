/** O servidor devolve no máximo 1000 linhas por pedido (mesmo com .limit(5000)): para trazer TUDO, pede de 1000 em 1000 até vir uma página incompleta. */
export const TAMANHO_PAGINA = 1000;
export async function buscarTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const r = await pagina(de, de + TAMANHO_PAGINA - 1);
    out.push(...r);
    if (r.length < TAMANHO_PAGINA) return out;
  }
}
