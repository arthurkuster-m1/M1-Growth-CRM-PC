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

/** Onde um lead está na cadência (para a coluna e o filtro "Cadência" do CRM). */
export interface LeadEmCadencia {
  lead_id: string;
  /** 1-based; no prazo de resposta fica no último. */
  passo: number;
  total: number;
  /** O dia do passo (D+N); nulo quando está só aguardando a resposta. */
  dia: number | null;
  aguardando: boolean;
  atrasado: boolean;
}

/** "D+2 · passo 2 de 3", "D0 · passo 1 de 3" ou "aguardando resposta". */
export function rotuloDaCadencia(l: LeadEmCadencia): string {
  if (l.aguardando) return "aguardando resposta";
  const dia = l.dia === 0 ? "D0" : `D+${l.dia}`;
  return `${dia} · passo ${l.passo} de ${l.total}`;
}
