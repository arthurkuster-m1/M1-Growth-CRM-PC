/** Os dashboards que existem, na ordem em que aparecem nas abas. */
export const PAINEIS = [
  "trafego",
  "prospeccao",
  "comercial",
  "atendimento",
  "business",
  "atividades",
] as const;
export type IdDoPainel = (typeof PAINEIS)[number];

/**
 * Lê os dashboards escondidos de `organizations.settings.dashboards.ocultos`. Nunca lança: valor
 * estranho no jsonb vira "nada escondido". Ids desconhecidos são ignorados (painel que saiu do
 * produto não deve esconder nada).
 */
export function lerOcultos(settings: unknown): IdDoPainel[] {
  const bruto = (settings as { dashboards?: { ocultos?: unknown } } | null)?.dashboards?.ocultos;
  if (!Array.isArray(bruto)) return [];
  return PAINEIS.filter((id) => bruto.includes(id));
}
