import { describe, expect, it } from "vitest";

import type { TarefaDoCronograma } from "./cronograma";
import { resumoDasSemanas, type EventoDaSemana } from "./historico-das-semanas";

const t = (
  id: string,
  status: TarefaDoCronograma["status"],
  due: string,
  lado: "agencia" | "cliente" = "agencia",
): TarefaDoCronograma => ({
  id,
  title: id,
  status,
  due_date: due,
  prazo_original: null,
  adiamentos: 0,
  lado,
});
const ev = (p: Partial<EventoDaSemana>): EventoDaSemana => ({
  id: "e",
  task_id: "x",
  tipo: "concluida",
  de_prazo: null,
  para_prazo: null,
  motivo: null,
  created_at: "2026-10-28T15:00:00Z",
  titulo: "x",
  lado: "agencia",
  ...p,
});

describe("histórico por semana, agência x cliente", () => {
  const r = resumoDasSemanas(
    [
      t("a", "done", "2026-10-27T15:00:00Z"),
      t("b", "pending", "2026-10-28T15:00:00Z", "cliente"),
      t("c", "cancelled", "2026-10-28T15:00:00Z"),
      t("d", "done", "2026-10-20T15:00:00Z"),
    ],
    [
      ev({ task_id: "a", tipo: "concluida", created_at: "2026-10-27T18:00:00Z" }),
      ev({
        id: "p",
        task_id: "z",
        tipo: "prazo_alterado",
        de_prazo: "2026-10-29T15:00:00Z",
        para_prazo: "2026-11-05T15:00:00Z",
        titulo: "z",
        lado: "cliente",
        motivo: "cliente pediu",
      }),
    ],
    [{ semana_inicio: "2026-10-25", nota: 80 }],
    "2026-11-01",
  );
  const s = r[0]!;
  it("mais recente primeiro, com a nota", () => {
    expect(r.map((x) => x.semana_inicio)).toEqual(["2026-10-25", "2026-10-18"]);
    expect(s.nota).toBe(80);
    expect(r[1]!.nota).toBeNull();
  });
  it("separa agência e cliente", () => {
    expect(s.agencia.map((i) => `${i.titulo}:${i.situacao}`)).toEqual(["a:feita", "c:cancelada"]);
    expect(s.cliente.map((i) => `${i.titulo}:${i.situacao}`)).toEqual(["z:adiada", "b:nao_feita"]);
  });
  it("traz quando foi feita, o novo prazo e o motivo", () => {
    expect(s.agencia[0]!.data).toBe("2026-10-27T18:00:00Z");
    expect(s.cliente[0]!.data).toBe("2026-11-05T15:00:00Z");
    expect(s.cliente[0]!.motivo).toBe("cliente pediu");
  });
  it("conta feitas e não feitas (adiada é não feita)", () => {
    expect(s.feitas).toBe(1);
    expect(s.nao_feitas).toBe(2);
  });
});

describe("anotações da revisão semanal", () => {
  it("traz os tópicos da autoavaliação, mesmo numa semana sem tarefas", () => {
    const r = resumoDasSemanas(
      [],
      [],
      [{ semana_inicio: "2026-10-25", nota: 70, anotacoes: "- Funcionou X\n\n* Travou Y" }],
      "2026-11-01",
    );
    expect(r[0]!.topicos).toEqual(["Funcionou X", "Travou Y"]);
  });
});
