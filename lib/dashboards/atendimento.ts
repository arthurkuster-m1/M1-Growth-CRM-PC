import { chaveDoDia, inicioDoDia, partesNoFuso, somarDias } from "@/lib/inicio/datas";

/**
 * O RELÓGIO DE RESPOSTA do atendimento. A empresa define o horário de atendimento; uma mensagem
 * que chega FORA dele só começa a contar quando o horário abre — e a resposta está "no prazo" se
 * vier em até 1 hora depois disso.
 */
export interface HorarioDeAtendimento {
  /** "HH:MM". */
  inicio: string;
  fim: string;
  /** 0 = domingo … 6 = sábado. */
  dias: number[];
}

export const HORARIO_PADRAO: HorarioDeAtendimento = {
  inicio: "09:00",
  fim: "18:00",
  dias: [1, 2, 3, 4, 5],
};

/** Prazo da resposta, em minutos, contado a partir do início do horário comercial. */
export const PRAZO_EM_MINUTOS = 60;

const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function lerHorario(bruto: unknown): HorarioDeAtendimento {
  const o = (bruto ?? {}) as Partial<HorarioDeAtendimento>;
  const ok = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const dias = Array.isArray(o.dias)
    ? [...new Set(o.dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : HORARIO_PADRAO.dias;
  return {
    inicio: ok(o.inicio) ? (o.inicio as string) : HORARIO_PADRAO.inicio,
    fim: ok(o.fim) ? (o.fim as string) : HORARIO_PADRAO.fim,
    dias: dias.length > 0 ? dias : HORARIO_PADRAO.dias,
  };
}

function diaDaSemana(chave: string): number {
  return new Date(`${chave}T12:00:00Z`).getUTCDay();
}

export function dentroDoHorario(instante: Date, h: HorarioDeAtendimento, fuso: string): boolean {
  const chave = chaveDoDia(instante, fuso);
  if (!h.dias.includes(diaDaSemana(chave))) return false;
  const p = partesNoFuso(instante, fuso);
  const min = p.hora * 60 + p.minuto;
  return min >= minutosDe(h.inicio) && min < minutosDe(h.fim);
}

/** Quando o relógio da mensagem começa a contar: agora, se aberto; senão a próxima abertura. */
export function inicioEfetivo(instante: Date, h: HorarioDeAtendimento, fuso: string): Date {
  if (dentroDoHorario(instante, h, fuso)) return instante;
  const hoje = chaveDoDia(instante, fuso);
  for (let k = 0; k < 8; k += 1) {
    const chave = somarDias(hoje, k);
    if (!h.dias.includes(diaDaSemana(chave))) continue;
    const abre = new Date(inicioDoDia(chave, fuso).getTime() + minutosDe(h.inicio) * 60_000);
    if (abre.getTime() > instante.getTime()) return abre;
  }
  return instante;
}

/** Minutos até a resposta, descontando o tempo fora do horário (a mensagem espera a abertura). */
export function minutosAteResponder(
  chegou: Date,
  respondeu: Date,
  h: HorarioDeAtendimento,
  fuso: string,
): number {
  const inicio = inicioEfetivo(chegou, h, fuso);
  return Math.max(0, (respondeu.getTime() - inicio.getTime()) / 60_000);
}

export function formatarMinutos(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return `${Math.max(1, Math.round(min * 60))} s`;
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${Math.round(h / 24)} d`;
}
