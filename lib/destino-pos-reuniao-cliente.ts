/**
 * "Compareceu e não comprou": quando uma tela registra isso, este evento abre, de qualquer lugar do
 * app, o diálogo que pergunta o que fazer com a oportunidade (ver `DestinoPosReuniao`).
 */
export const EVENTO_DESTINO_POS_REUNIAO = "m1:destino-pos-reuniao";

export function pedirDestinoPosReuniao(leadId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_DESTINO_POS_REUNIAO, { detail: { leadId } }));
}
