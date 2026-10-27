/**
 * O gesto de ARRASTAR PARA O LADO que troca o período da Agenda no celular: da direita para a
 * esquerda avança, da esquerda para a direita volta. Só vale quando o movimento é bem mais
 * horizontal que vertical (rolar a página não pode trocar o período) e passa de um mínimo.
 */
export const DISTANCIA_MINIMA_DO_GESTO_PX = 60;
const PROPORCAO_HORIZONTAL = 1.5;

/** +1 = próximo período, -1 = anterior, 0 = não foi um gesto de troca. */
export function direcaoDoGesto(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < DISTANCIA_MINIMA_DO_GESTO_PX) return 0;
  if (Math.abs(dx) < Math.abs(dy) * PROPORCAO_HORIZONTAL) return 0;
  return dx < 0 ? 1 : -1;
}

/** O gesto não começa em quem já usa o toque para outra coisa: cartão que se arrasta, campos, botões. */
export function gestoPodeComecarEm(alvo: EventTarget | null): boolean {
  const el = alvo instanceof Element ? alvo : null;
  if (!el) return true;
  return !el.closest('[data-testid^="agendamento-"], input, textarea, select, [role="dialog"]');
}
