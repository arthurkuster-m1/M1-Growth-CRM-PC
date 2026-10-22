/**
 * Ler e gravar um valor dentro de um bloco por CAMINHO (`["itens", 2, "titulo"]`), sem mutar:
 * é como a edição no lugar diz ao bloco qual texto mudou.
 */
export type Caminho = readonly (string | number)[];

export function lerNoCaminho(objeto: unknown, caminho: Caminho): unknown {
  let atual: unknown = objeto;
  for (const passo of caminho) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string | number, unknown>)[passo];
  }
  return atual;
}

export function gravarNoCaminho<T>(objeto: T, caminho: Caminho, valor: unknown): T {
  if (caminho.length === 0) return valor as T;
  const [passo, ...resto] = caminho as [string | number, ...(string | number)[]];
  if (Array.isArray(objeto)) {
    const copia = [...objeto];
    copia[passo as number] = gravarNoCaminho(copia[passo as number], resto, valor);
    return copia as unknown as T;
  }
  const origem = (objeto ?? {}) as Record<string | number, unknown>;
  return { ...origem, [passo]: gravarNoCaminho(origem[passo], resto, valor) } as T;
}
