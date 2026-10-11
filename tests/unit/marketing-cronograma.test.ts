import { describe, expect, it } from "vitest";

import {
  fasesDoCronograma,
  itemSchema,
  numeroDaSemana,
  periodoDaSemana,
  progressoDaMeta,
  segundaDe,
  segundaDaSemana,
  situacaoDaTarefa,
  tarefasDaSemana,
  type ItemDoCronograma,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";

const item = (p: Partial<ItemDoCronograma>): ItemDoCronograma => ({
  id: "i",
  acao: "x",
  semana_inicio: 1,
  semana_fim: 1,
  status: "planejado",
  destaque: false,
  notas: "",
  fase: "",
  ordem: 1,
  ...p,
});

const tarefa = (p: Partial<TarefaDoCronograma>): TarefaDoCronograma => ({
  id: "t",
  title: "t",
  status: "pending",
  due_date: null,
  prazo_original: null,
  adiamentos: 0,
  lado: "agencia",
  ...p,
});

describe("semanas do cronograma", () => {
  it("a semana começa na segunda-feira", () => {
    expect(segundaDe("2026-10-14")).toBe("2026-10-12"); // quarta → segunda
    expect(segundaDe("2026-10-18")).toBe("2026-10-12"); // domingo → segunda anterior
    expect(periodoDaSemana("2026-10-12")).toBe("12/10 – 18/10");
  });

  it("numera a semana contra a data de início e recusa fora do intervalo", () => {
    const cfg = { data_inicio: "2026-10-05", total_semanas: 8 };
    expect(numeroDaSemana(cfg, "2026-10-05")).toBe(1);
    expect(numeroDaSemana(cfg, "2026-10-19")).toBe(3);
    expect(numeroDaSemana(cfg, "2026-09-28")).toBeNull();
    expect(numeroDaSemana(cfg, "2026-12-07")).toBeNull();
    expect(numeroDaSemana({ data_inicio: null, total_semanas: 8 }, "2026-10-05")).toBeNull();
    expect(segundaDaSemana("2026-10-05", 3)).toBe("2026-10-19");
  });

  it("valida a ação: fim não vem antes do início", () => {
    expect(
      itemSchema.safeParse({ acao: "Landing page", semana_inicio: 2, semana_fim: 4 }).success,
    ).toBe(true);
    expect(itemSchema.safeParse({ acao: "x", semana_inicio: 4, semana_fim: 2 }).success).toBe(
      false,
    );
    expect(itemSchema.safeParse({ acao: " ", semana_inicio: 1, semana_fim: 1 }).success).toBe(
      false,
    );
  });
});

describe("metas e fases", () => {
  it("lê o progresso de textos livres", () => {
    expect(progressoDaMeta("R$ 8.000/mês", "R$ 2.000")).toBe(25);
    expect(progressoDaMeta("6 clientes", "3")).toBe(50);
    expect(progressoDaMeta("R$ 8.000", "R$ 9.000")).toBe(100);
    expect(progressoDaMeta("crescer", "pouco")).toBeNull();
  });

  it("deriva as fases na ordem e a situação", () => {
    const itens = [
      item({ fase: "Estruturação", semana_inicio: 1, semana_fim: 2, status: "concluido" }),
      item({ fase: "Estruturação", semana_inicio: 2, semana_fim: 3, status: "concluido" }),
      item({ fase: "Aquisição", semana_inicio: 4, semana_fim: 6, status: "andamento" }),
      item({ fase: "Escala", semana_inicio: 7, semana_fim: 8 }),
      item({ fase: "" }),
    ];
    const fases = fasesDoCronograma(itens, 5);
    expect(fases.map((f) => f.nome)).toEqual(["Estruturação", "Aquisição", "Escala"]);
    expect(fases.map((f) => f.situacao)).toEqual(["feita", "ativa", "futura"]);
    expect(fases[0]).toMatchObject({ inicio: 1, fim: 3 });
  });
});

describe("tarefas da semana", () => {
  const agora = new Date("2026-10-14T15:00:00Z"); // quarta, 12:00 em Brasília

  it("situação: feita, atrasada, em andamento, a fazer", () => {
    expect(situacaoDaTarefa(tarefa({ status: "done" }), agora)).toBe("feita");
    expect(situacaoDaTarefa(tarefa({ due_date: "2026-10-10T15:00:00Z" }), agora)).toBe("atrasada");
    expect(
      situacaoDaTarefa(tarefa({ status: "in_progress", due_date: "2026-10-20T15:00:00Z" }), agora),
    ).toBe("andamento");
    expect(situacaoDaTarefa(tarefa({ due_date: "2026-10-20T15:00:00Z" }), agora)).toBe("a_fazer");
    expect(situacaoDaTarefa(tarefa({ status: "cancelled" }), agora)).toBe("cancelada");
  });

  it("mostra as do prazo da semana e as atrasadas abertas; o cancelado some", () => {
    const todas = [
      tarefa({ id: "na-semana", due_date: "2026-10-15T15:00:00Z" }),
      tarefa({ id: "feita-na-semana", status: "done", due_date: "2026-10-13T15:00:00Z" }),
      tarefa({ id: "atrasada", due_date: "2026-10-02T15:00:00Z" }),
      tarefa({ id: "feita-antiga", status: "done", due_date: "2026-10-02T15:00:00Z" }),
      tarefa({ id: "cancelada", status: "cancelled", due_date: "2026-10-15T15:00:00Z" }),
      tarefa({ id: "proxima", due_date: "2026-10-22T15:00:00Z" }),
      tarefa({ id: "sem-prazo", due_date: null }),
    ];
    const ids = tarefasDaSemana(todas, "2026-10-12", agora).map((t) => t.id);
    expect(ids.sort()).toEqual(["atrasada", "feita-na-semana", "na-semana"]);
  });

  it("a atrasada não invade semanas passadas", () => {
    const todas = [tarefa({ id: "atrasada", due_date: "2026-10-02T15:00:00Z" })];
    expect(tarefasDaSemana(todas, "2026-10-05", agora)).toEqual([]);
  });
});
