import { describe, expect, it } from "vitest";

import type { TarefaDoCronograma } from "./cronograma";
import { resumoDasSemanas } from "./historico-das-semanas";

const t = (id: string, status: TarefaDoCronograma["status"], due: string): TarefaDoCronograma => ({
  id,
  title: id,
  status,
  due_date: due,
  prazo_original: null,
  adiamentos: 0,
  lado: "agencia",
});

describe("histórico por semana", () => {
  const r = resumoDasSemanas(
    [
      t("a", "done", "2026-10-27T15:00:00Z"),
      t("b", "pending", "2026-10-28T15:00:00Z"),
      t("c", "cancelled", "2026-10-28T15:00:00Z"),
      t("d", "done", "2026-10-20T15:00:00Z"),
    ],
    [],
    [{ semana_inicio: "2026-10-25", nota: 80 }],
    "2026-11-01",
  );
  it("agrupa por semana, mais recente primeiro", () => {
    expect(r.map((s) => s.semana_inicio)).toEqual(["2026-10-25", "2026-10-18"]);
  });
  it("separa feitas e não feitas, sem contar cancelada, e traz a nota", () => {
    expect(r[0]!.feitas.map((x) => x.id)).toEqual(["a"]);
    expect(r[0]!.nao_feitas.map((x) => x.id)).toEqual(["b"]);
    expect(r[0]!.nota).toBe(80);
    expect(r[1]!.nota).toBeNull();
  });
});
