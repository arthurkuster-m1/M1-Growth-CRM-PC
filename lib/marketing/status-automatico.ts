import type { StatusDaCampanha } from "@/lib/marketing/campanhas";

/**
 * O STATUS AUTOMÁTICO da campanha, decidido pelo que o Meta entrega:
 *
 *  - começou a receber dados do Meta (gasto ou impressões nos últimos dias) → "Ativa";
 *  - passou da data final e o Meta parou de entregar → "Encerrada" (aparece como "Finalizada").
 *
 * Duas travas para não brigar com a pessoa:
 *  - "Pausada" é decisão humana: nunca é mexida aqui (e nunca volta sozinha para Ativa);
 *  - campanha contínua (sem data final) nunca é finalizada por data.
 *
 * Os dados do Meta chegam com atraso de até um dia, então "recebendo" olha os últimos 3 dias
 * (hoje e os dois anteriores) — um dia sem gasto não finaliza nada.
 */
export const DIAS_DE_TOLERANCIA = 2;

export interface DiaDoMeta {
  day: string;
  spend: number | null;
  impressions: number | null;
}

const MS_DO_DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** O novo status, ou `null` quando nada muda. `hoje` é `YYYY-MM-DD`. */
export function statusAutomatico(
  c: {
    status: StatusDaCampanha;
    end_date: string | null;
    continuous: boolean;
  },
  diasDoMeta: readonly DiaDoMeta[],
  hoje: string,
): StatusDaCampanha | null {
  if (c.status === "pausada") return null;
  const limite = iso(Date.parse(`${hoje}T12:00:00Z`) - DIAS_DE_TOLERANCIA * MS_DO_DIA);
  const recebendo = diasDoMeta.some(
    (d) => d.day >= limite && ((d.spend ?? 0) > 0 || (d.impressions ?? 0) > 0),
  );
  const passouDoFim = !c.continuous && c.end_date !== null && c.end_date < hoje;

  if (recebendo && (c.status === "planejada" || c.status === "encerrada")) return "ativa";
  if (!recebendo && passouDoFim && c.status === "ativa") return "encerrada";
  return null;
}
