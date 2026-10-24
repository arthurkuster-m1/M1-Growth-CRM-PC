import { classificarResultado } from "@/lib/dashboards/prospeccao";
import { somarTagComContador } from "@/lib/leads/acoes-do-lead";

/**
 * AS TAGS QUE UMA ABORDAGEM PÕE SOZINHA, no contato (onde as tags do CRM moram):
 *
 *  - "Contato" e "Contato com decisor": marcas de ESTADO — entram uma vez, sem contador (o
 *    decisor implica o contato). A conta por dia NÃO sai delas: sai do histórico datado, que não
 *    se apaga; quem remove a tag depois não muda o passado.
 *  - "Abordagem: X": marca de USO — com contador ("Abordagem: X: 3x"), que mostra quantas vezes
 *    aquela abordagem foi usada naquele contato.
 */
export const TAG_CONTATO = "Contato";
export const TAG_CONTATO_COM_DECISOR = "Contato com decisor";

export interface TagsAutomaticas {
  /** Marcas de estado: entram uma vez. */
  fixas: string[];
  /** Marca de uso da abordagem (a base; o contador é somado ao aplicar). */
  abordagem: string | null;
}

export function tagsAutomaticasDaAbordagem(entrada: {
  resultado?: string | null;
  abordagemNome?: string | null;
}): TagsAutomaticas {
  const { contato, decisor } = classificarResultado(entrada.resultado ?? "");
  const fixas: string[] = [];
  if (contato) fixas.push(TAG_CONTATO);
  if (decisor) fixas.push(TAG_CONTATO_COM_DECISOR);
  const nome = (entrada.abordagemNome ?? "").trim();
  return { fixas, abordagem: nome ? `Abordagem: ${nome}`.slice(0, 30).trim() : null };
}

/** Soma as tags automáticas às do contato: fixas uma vez (sem diferenciar caixa), abordagem com contador. */
export function aplicarTagsAutomaticas(tags: readonly string[], auto: TagsAutomaticas): string[] {
  let saida = [...tags];
  for (const fixa of auto.fixas) {
    if (!saida.some((t) => t.trim().toLowerCase() === fixa.toLowerCase())) saida.push(fixa);
  }
  if (auto.abordagem) saida = somarTagComContador(saida, auto.abordagem);
  return saida;
}

/** O que foi posto, para o histórico da ação: as fixas e a tag de abordagem (sem o contador). */
export function listarTagsAutomaticas(auto: TagsAutomaticas): string[] {
  return [...auto.fixas, ...(auto.abordagem ? [auto.abordagem] : [])];
}
