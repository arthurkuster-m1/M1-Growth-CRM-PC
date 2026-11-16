import { describe, expect, it, vi } from "vitest";

import {
  duracaoCurta,
  euCronometro,
  formatarDuracao,
  segundosDaTarefa,
  temposDasTarefas,
} from "./tempo";

const AGORA = Date.parse("2026-11-16T12:00:00Z");

describe("tempo das tarefas", () => {
  it("soma o fechado com o que cada cronômetro rodando já contou", () => {
    const t = {
      tempo_gasto_seg: 600,
      cronometros: [
        { user_id: "a", started_at: "2026-11-16T11:59:00Z" }, // 60 s
        { user_id: "b", started_at: "2026-11-16T11:58:30Z" }, // 90 s
      ],
    };
    expect(segundosDaTarefa(t, AGORA)).toBe(750);
    expect(segundosDaTarefa({}, AGORA)).toBe(0);
  });

  it("relógio adiantado do navegador nunca dá tempo negativo", () => {
    expect(
      segundosDaTarefa(
        { cronometros: [{ user_id: "a", started_at: "2026-11-16T12:00:30Z" }] },
        AGORA,
      ),
    ).toBe(0);
  });

  it("formata h:mm:ss, m:ss e a forma curta", () => {
    expect(formatarDuracao(0)).toBe("0:00");
    expect(formatarDuracao(65)).toBe("1:05");
    expect(formatarDuracao(3725)).toBe("1:02:05");
    expect(duracaoCurta(0)).toBe("—");
    expect(duracaoCurta(40)).toBe("40s");
    expect(duracaoCurta(720)).toBe("12min");
    expect(duracaoCurta(7500)).toBe("2h 05min");
  });

  it("acha o cronômetro da própria pessoa", () => {
    const t = { cronometros: [{ user_id: "a", started_at: "x" }] };
    expect(euCronometro(t, "a")).toBeDefined();
    expect(euCronometro(t, "b")).toBeUndefined();
  });

  it("lê os tempos do banco por tarefa e, se o banco falha, devolve vazio sem quebrar a lista", async () => {
    const ok = {
      rpc: vi.fn(async () => ({
        data: [
          { task_id: "t1", total_seconds: "120", running: [{ user_id: "a", started_at: "s" }] },
        ],
        error: null,
      })),
    };
    const mapa = await temposDasTarefas(ok as never, "org");
    expect(mapa.get("t1")).toEqual({
      tempo_gasto_seg: 120,
      cronometros: [{ user_id: "a", started_at: "s" }],
    });
    const quebrado = { rpc: vi.fn(async () => ({ data: null, error: { code: "42883" } })) };
    expect((await temposDasTarefas(quebrado as never, "org")).size).toBe(0);
    const explode = {
      rpc: vi.fn(async () => {
        throw new Error("rede");
      }),
    };
    expect((await temposDasTarefas(explode as never, "org")).size).toBe(0);
  });
});
