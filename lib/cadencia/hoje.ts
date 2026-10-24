import type { MeioDaAbordagem } from "@/lib/marketing/abordagens";

/**
 * O PASSO DE HOJE: o que a cadência pede deste lead agora. Não é gravado em lugar nenhum — sai
 * da inscrição (passo atual + data) e do desenho, para nunca divergir deles.
 */
export interface PassoDeHoje {
  lead_id: string;
  /** 1-based. */
  passo: number;
  total: number;
  medium: MeioDaAbordagem;
  nota: string;
  abordagem: { id: string; name: string; hook: string; script: string } | null;
  /** Quando o passo vence (ISO). */
  vence_em: string;
}

const DIA_MS = 86_400_000;

/** Dias de atraso do passo em relação a hoje (data local `YYYY-MM-DD`); 0 = vence hoje, negativo = ainda não. */
export function atrasoEmDias(venceEm: string, hojeIso: string): number {
  const vence = new Intl.DateTimeFormat("en-CA").format(new Date(venceEm));
  return Math.round(
    (Date.parse(`${hojeIso}T12:00:00Z`) - Date.parse(`${vence}T12:00:00Z`)) / DIA_MS,
  );
}

/** Vence hoje ou já venceu. */
export const venceAteHoje = (venceEm: string, hojeIso: string) =>
  atrasoEmDias(venceEm, hojeIso) >= 0;
