import { describe, expect, it } from "vitest";

import {
  JORNADA_PADRAO,
  janelasDaAgenda,
  janelasDaJornada,
  jornadaDasJanelas,
  resumoDasJanelas,
  validarJornada,
} from "./horarios";

describe("validarJornada", () => {
  it("aceita a jornada padrão", () => {
    expect(validarJornada(JORNADA_PADRAO)).toBeNull();
  });
  it("pede ao menos um dia, formato HH:MM e início antes do fim", () => {
    expect(validarJornada({ ...JORNADA_PADRAO, dias: [] })).toMatch(/pelo menos um dia/);
    expect(validarJornada({ ...JORNADA_PADRAO, inicio: "8h" })).toMatch(/HH:MM/);
    expect(validarJornada({ ...JORNADA_PADRAO, fim: "25:00" })).toMatch(/HH:MM/);
    expect(validarJornada({ ...JORNADA_PADRAO, inicio: "18:00", fim: "08:00" })).toMatch(
      /antes do fim/,
    );
    expect(validarJornada({ ...JORNADA_PADRAO, inicio: "09:00", fim: "09:00" })).toMatch(
      /antes do fim/,
    );
    expect(validarJornada({ ...JORNADA_PADRAO, dias: [7] })).toMatch(/inválido/);
  });
});

describe("janelasDaJornada", () => {
  it("uma janela por dia, ordenada, sem repetir dia", () => {
    expect(janelasDaJornada({ dias: [5, 1, 1, 3], inicio: "09:00", fim: "17:30" })).toEqual([
      { dow: 1, start: "09:00", end: "17:30" },
      { dow: 3, start: "09:00", end: "17:30" },
      { dow: 5, start: "09:00", end: "17:30" },
    ]);
  });
});

describe("jornadaDasJanelas e resumo", () => {
  const seg_sex = janelasDaJornada(JORNADA_PADRAO);

  it("ida e volta: o que o assistente grava, ele lê de novo", () => {
    expect(jornadaDasJanelas(seg_sex)).toEqual({
      dias: [1, 2, 3, 4, 5],
      inicio: "08:00",
      fim: "18:00",
    });
  });

  it("horários diferentes por dia não são reduzidos", () => {
    const misto = [
      { dow: 1, start: "08:00", end: "12:00" },
      { dow: 2, start: "13:00", end: "18:00" },
    ];
    expect(jornadaDasJanelas(misto)).toBeNull();
    expect(resumoDasJanelas(misto)).toBe("Horários diferentes por dia");
  });

  it("resumo em português", () => {
    expect(resumoDasJanelas(seg_sex)).toBe("Seg a Sex, 08:00–18:00");
    expect(
      resumoDasJanelas(janelasDaJornada({ dias: [1, 3, 5], inicio: "09:00", fim: "12:00" })),
    ).toBe("Seg, Qua e Sex, 09:00–12:00");
    expect(resumoDasJanelas(janelasDaJornada({ dias: [6], inicio: "09:00", fim: "13:00" }))).toBe(
      "Sáb, 09:00–13:00",
    );
    expect(
      resumoDasJanelas(
        janelasDaJornada({ dias: [1, 2, 3, 4, 5, 6, 0], inicio: "08:00", fim: "20:00" }),
      ),
    ).toBe("Seg a Dom, 08:00–20:00");
    expect(resumoDasJanelas([])).toMatch(/sempre disponível/);
  });
});

describe("janelasDaAgenda", () => {
  it("lê o que o banco guardou e ignora o que não tem o formato", () => {
    expect(
      janelasDaAgenda({
        timezone: "America/Sao_Paulo",
        windows: [{ dow: 1, start: "08:00", end: "18:00" }, { dow: "x" }],
      }),
    ).toEqual([{ dow: 1, start: "08:00", end: "18:00" }]);
    expect(janelasDaAgenda({})).toEqual([]);
    expect(janelasDaAgenda(null)).toEqual([]);
  });
});
