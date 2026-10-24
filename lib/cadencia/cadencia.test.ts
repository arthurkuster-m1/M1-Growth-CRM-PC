import { describe, expect, it } from "vitest";

import {
  aposRegistrarPasso,
  cadenciaSchema,
  ordenarPassos,
  DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO,
} from "./cadencia";

const passo = { day_offset: 0, medium: "whatsapp", approach_id: null, note: "" } as const;

describe("cadenciaSchema", () => {
  it("aceita passos e fim 'perdido'", () => {
    expect(
      cadenciaSchema.safeParse({ end_action: "perdido", end_stage_id: null, steps: [passo] })
        .success,
    ).toBe(true);
  });
  it("destino 'etapa' exige a etapa", () => {
    expect(
      cadenciaSchema.safeParse({ end_action: "etapa", end_stage_id: null, steps: [] }).success,
    ).toBe(false);
  });
  it("recusa dia negativo e meio desconhecido", () => {
    const base = { end_action: "perdido", end_stage_id: null };
    expect(
      cadenciaSchema.safeParse({ ...base, steps: [{ ...passo, day_offset: -1 }] }).success,
    ).toBe(false);
    expect(
      cadenciaSchema.safeParse({ ...base, steps: [{ ...passo, medium: "pombo" }] }).success,
    ).toBe(false);
  });
});

describe("ordenarPassos", () => {
  it("ordena pelo dia e mantém a ordem dentro do mesmo dia", () => {
    const r = ordenarPassos([
      { day_offset: 3, n: "c" },
      { day_offset: 0, n: "a" },
      { day_offset: 0, n: "b" },
    ]);
    expect(r.map((x) => x.n)).toEqual(["a", "b", "c"]);
  });
});

describe("aposRegistrarPasso", () => {
  const inicio = new Date("2026-10-01T12:00:00Z");
  const agora = new Date("2026-10-01T15:00:00Z");
  const passos = [{ day_offset: 0 }, { day_offset: 2 }, { day_offset: 5 }];
  it("o próximo passo vence no dia dele, contado do início", () => {
    const r = aposRegistrarPasso(passos, 0, inicio, agora);
    expect(r.current_step).toBe(1);
    expect(r.next_due_at.toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });
  it("depois do último passo dá o prazo de resposta", () => {
    const r = aposRegistrarPasso(passos, 2, inicio, agora);
    expect(r.current_step).toBe(3);
    expect(r.next_due_at.getTime() - agora.getTime()).toBe(
      DIAS_PARA_RESPONDER_DEPOIS_DO_ULTIMO_PASSO * 86_400_000,
    );
  });
});
