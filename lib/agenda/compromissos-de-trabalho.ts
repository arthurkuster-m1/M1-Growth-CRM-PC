import type { Agendamento } from "@/components/agenda/tipos";

/**
 * Do que a lista da Agenda devolve, só o que é COMPROMISSO de trabalho.
 *
 * A rota também entrega a ocupação das outras agendas do Google (`origem: "google_sync"`):
 * blocos anônimos "Ocupado" — o treino, a meditação, o que for pessoal. Eles precisam existir
 * na grade da Agenda e nos horários livres (para não marcar cliente por cima), mas não são
 * trabalho, então telas que mostram "o que tenho para fazer" (o Início) ficam sem eles.
 */
export function compromissosDeTrabalho<T extends Pick<Agendamento, "origem" | "situacao">>(
  lista: readonly T[],
): T[] {
  return lista.filter((a) => a.origem !== "google_sync" && a.situacao !== "cancelled");
}
