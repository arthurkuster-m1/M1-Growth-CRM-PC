import { describe, expect, it } from "vitest";

import {
  HORARIO_PADRAO,
  dentroDoHorario,
  formatarMinutos,
  inicioEfetivo,
  lerHorario,
  minutosAteResponder,
} from "./atendimento";

const SP = "America/Sao_Paulo";
// 14/10/2026 é uma quarta-feira.
const em = (iso: string) => new Date(iso);

describe("relógio de resposta", () => {
  it("dentro do horário conta a partir da chegada", () => {
    // 10:00 em SP = 13:00Z
    const chegou = em("2026-10-14T13:00:00Z");
    expect(dentroDoHorario(chegou, HORARIO_PADRAO, SP)).toBe(true);
    expect(minutosAteResponder(chegou, em("2026-10-14T13:20:00Z"), HORARIO_PADRAO, SP)).toBe(20);
  });
  it("fora do horário espera a abertura (09:00 do próximo dia útil)", () => {
    // quarta 21:00 em SP = quinta 00:00Z → abre quinta 09:00 SP = 12:00Z
    const chegou = em("2026-10-15T00:00:00Z");
    expect(dentroDoHorario(chegou, HORARIO_PADRAO, SP)).toBe(false);
    expect(inicioEfetivo(chegou, HORARIO_PADRAO, SP).toISOString()).toBe("2026-10-15T12:00:00.000Z");
    // respondeu 09:30 → 30 min (no prazo de 60)
    expect(minutosAteResponder(chegou, em("2026-10-15T12:30:00Z"), HORARIO_PADRAO, SP)).toBe(30);
  });
  it("sexta à noite espera segunda", () => {
    // sexta 20:00 SP = sábado 23:00Z? 20:00 SP = 23:00Z do mesmo dia (UTC-3): 2026-10-16T23:00Z
    const chegou = em("2026-10-16T23:00:00Z");
    expect(inicioEfetivo(chegou, HORARIO_PADRAO, SP).toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });
  it("lê horário inválido com o padrão e formata minutos", () => {
    expect(lerHorario({ inicio: "9h", fim: "99:99", dias: [] })).toEqual(HORARIO_PADRAO);
    expect(formatarMinutos(0.2)).toBe("12 s");
    expect(formatarMinutos(14)).toBe("14 min");
    expect(formatarMinutos(90)).toBe("1,5 h");
    expect(formatarMinutos(null)).toBe("—");
  });
});
