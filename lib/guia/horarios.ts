/**
 * O ASSISTENTE DE HORÁRIOS (passo P42): "que dias e horários vocês atendem?" vira a jornada que o
 * roteamento já entende (`{ timezone, windows: [{ dow, start, end }] }`, dow 0 = domingo). Funções
 * PURAS; quem grava é a rota de disponibilidade que já existe (`PATCH /api/v1/attendants/availability/[id]`).
 */
export interface Janela {
  dow: number;
  start: string;
  end: string;
}

export interface JornadaSimples {
  /** 0 = domingo … 6 = sábado. */
  dias: readonly number[];
  /** "HH:MM" */
  inicio: string;
  fim: string;
}

export const DIAS_DA_SEMANA = [
  { dow: 1, curto: "Seg" },
  { dow: 2, curto: "Ter" },
  { dow: 3, curto: "Qua" },
  { dow: 4, curto: "Qui" },
  { dow: 5, curto: "Sex" },
  { dow: 6, curto: "Sáb" },
  { dow: 0, curto: "Dom" },
] as const;

export const JORNADA_PADRAO: JornadaSimples = {
  dias: [1, 2, 3, 4, 5],
  inicio: "08:00",
  fim: "18:00",
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `null` = válida; senão, a frase que diz o que corrigir. */
export function validarJornada(j: JornadaSimples): string | null {
  if (j.dias.length === 0) return "Escolha pelo menos um dia.";
  if (j.dias.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "Dia inválido.";
  if (!HHMM.test(j.inicio) || !HHMM.test(j.fim)) return "Use o formato HH:MM, por exemplo 08:00.";
  if (j.inicio >= j.fim) return "O início precisa ser antes do fim.";
  return null;
}

/** A jornada simples vira as janelas do roteamento (uma por dia escolhido, sem repetir dia). */
export function janelasDaJornada(j: JornadaSimples): Janela[] {
  return [...new Set(j.dias)]
    .sort((a, b) => a - b)
    .map((dow) => ({ dow, start: j.inicio, end: j.fim }));
}

/**
 * As janelas gravadas → a jornada simples, SE todas têm o mesmo horário (dá para pré-preencher o
 * assistente sem perder nada). Janelas diferentes por dia = `null`: o assistente não as reduz.
 */
export function jornadaDasJanelas(janelas: readonly Janela[]): JornadaSimples | null {
  const primeira = janelas[0];
  if (!primeira) return null;
  if (!janelas.every((w) => w.start === primeira.start && w.end === primeira.end)) return null;
  return { dias: janelas.map((w) => w.dow), inicio: primeira.start, fim: primeira.end };
}

/** "Seg a Sex, 08:00–18:00" (ou "Seg, Qua e Sex, …"; "24 horas" quando não há janela). */
export function resumoDasJanelas(janelas: readonly Janela[]): string {
  const j = jornadaDasJanelas(janelas);
  if (!j)
    return janelas.length === 0
      ? "Sem horário definido (sempre disponível)"
      : "Horários diferentes por dia";
  const ordem = DIAS_DA_SEMANA.map((d) => d.dow as number);
  const dias = [...new Set(j.dias)].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  const nome = (dow: number) => DIAS_DA_SEMANA.find((d) => d.dow === dow)!.curto;
  const seguidos = dias.every(
    (d, i) => i === 0 || ordem.indexOf(d) === ordem.indexOf(dias[i - 1]!) + 1,
  );
  const rotuloDosDias =
    dias.length >= 3 && seguidos
      ? `${nome(dias[0]!)} a ${nome(dias[dias.length - 1]!)}`
      : dias.length === 1
        ? nome(dias[0]!)
        : `${dias.slice(0, -1).map(nome).join(", ")} e ${nome(dias[dias.length - 1]!)}`;
  return `${rotuloDosDias}, ${j.inicio}–${j.fim}`;
}

/** As janelas de uma agenda gravada (`unknown` do banco), ou nenhuma se o formato não for o esperado. */
export function janelasDaAgenda(agenda: unknown): Janela[] {
  const w = (agenda as { windows?: unknown } | null)?.windows;
  if (!Array.isArray(w)) return [];
  return w.filter(
    (x): x is Janela =>
      !!x &&
      typeof (x as Janela).dow === "number" &&
      typeof (x as Janela).start === "string" &&
      typeof (x as Janela).end === "string",
  );
}
