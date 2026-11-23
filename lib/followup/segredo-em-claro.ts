/**
 * PURO, sem imports: este arquivo vai para o navegador (a validação de publicação é importada pelas telas do
 * editor). O módulo que CIFRA o segredo — `segredos-do-grafo.ts` — é de servidor e fica separado.
 */

export type AcaoDoNo = { type: string; config?: Record<string, unknown> };

/** Há segredo em claro nesta ação (ou dentro de uma opção do "a IA decide")? */
export function temSegredoEmClaro(acao: AcaoDoNo): boolean {
  if (typeof acao.config?.secret === "string" && acao.config.secret.length > 0) return true;
  if (acao.type === "ai_decide" && Array.isArray(acao.config?.opcoes)) {
    return (acao.config.opcoes as Array<{ acao?: AcaoDoNo }>).some(
      (o) => !!o?.acao && temSegredoEmClaro(o.acao),
    );
  }
  return false;
}
