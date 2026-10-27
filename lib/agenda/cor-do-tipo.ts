/**
 * A COR de um tipo de compromisso, para a tag colorida. O cadastro de tipos não guarda cor
 * (`calendar_event_types` não tem a coluna), então ela sai do próprio id: a mesma para sempre, e
 * diferente entre tipos vizinhos.
 */
const PALETA = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
] as const;

export function corDoTipo(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length]!;
}
