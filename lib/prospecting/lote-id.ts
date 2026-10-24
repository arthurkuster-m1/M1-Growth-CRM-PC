import "server-only";

import { createHash } from "node:crypto";

/** O `request_id` de cada busca do lote: derivado do id do lote, então repetir o pedido não duplica. */
export function idDaBuscaDoLote(requestId: string, indice: number): string {
  const h = createHash("sha256").update(`${requestId}:${indice}`).digest("hex");
  // Forma de UUID v4 (versão e variante fixas): é o que o campo `request_id` exige.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
