import { janelaDoPeriodo } from "@/lib/marketing/periodos";

/**
 * O período que as telas da campanha analisam por padrão: do início ao fim da campanha; sem
 * datas (ou contínua), o mês atual. Datas `AAAA-MM-DD`; `hoje` já no relógio de quem olha.
 */
export function periodoPadraoDaCampanha(
  c: { start_date: string | null; end_date: string | null; continuous: boolean },
  hoje: string,
): { de: string; ate: string } {
  if (!c.continuous && c.start_date && c.end_date && c.start_date <= c.end_date) {
    return { de: c.start_date, ate: c.end_date };
  }
  const mes = janelaDoPeriodo("mes", hoje);
  return { de: mes.de, ate: mes.ate };
}
