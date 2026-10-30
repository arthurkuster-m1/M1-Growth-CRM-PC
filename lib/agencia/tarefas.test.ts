import { describe, expect, it } from "vitest";

import { agruparTarefas, grupoDaTarefa, type TarefaDaAgencia } from "./tarefas";

const AGORA = new Date("2026-10-30T15:00:00Z");
const t = (o: Partial<TarefaDaAgencia>): TarefaDaAgencia => ({
  id: "x",
  titulo: "T",
  status: "pending",
  prazo: null,
  adiamentos: 0,
  clienteId: "c",
  cliente: "Cliente",
  ...o,
});

describe("grupos das tarefas da agência", () => {
  it("separa atrasada, hoje, próximos 7 dias, depois e sem prazo", () => {
    expect(grupoDaTarefa(t({ prazo: "2026-10-28T15:00:00Z" }), AGORA)).toBe("atrasadas");
    expect(grupoDaTarefa(t({ prazo: "2026-10-30T20:00:00Z" }), AGORA)).toBe("hoje");
    expect(grupoDaTarefa(t({ prazo: "2026-11-04T15:00:00Z" }), AGORA)).toBe("semana");
    expect(grupoDaTarefa(t({ prazo: "2026-12-04T15:00:00Z" }), AGORA)).toBe("depois");
    expect(grupoDaTarefa(t({}), AGORA)).toBe("sem_prazo");
  });
  it("concluída vai para o seu grupo e cancelada some", () => {
    const g = agruparTarefas([t({ id: "a", status: "done" }), t({ id: "b", status: "cancelled" })], AGORA);
    expect(g.map((x) => x.grupo)).toEqual(["feitas"]);
    expect(g[0]!.tarefas.map((x) => x.id)).toEqual(["a"]);
  });
  it("ordena pelo prazo e, no empate, pelo cliente", () => {
    const g = agruparTarefas(
      [
        t({ id: "1", prazo: "2026-11-03T15:00:00Z", cliente: "Zeta" }),
        t({ id: "2", prazo: "2026-11-02T15:00:00Z", cliente: "Beta" }),
        t({ id: "3", prazo: "2026-11-02T15:00:00Z", cliente: "Alfa" }),
      ],
      AGORA,
    );
    expect(g[0]!.tarefas.map((x) => x.id)).toEqual(["3", "2", "1"]);
  });
});
