import { describe, expect, it } from "vitest";

import {
  modeloSchema,
  proximaExecucao,
  tarefaDoModelo,
  type RegraDeRepeticao,
} from "@/lib/tarefas/modelos";

const SP = "America/Sao_Paulo";
// 2026-10-08 é quinta-feira. 07:00 em São Paulo (UTC-3) = 10:00Z.
const regra = (r: Partial<RegraDeRepeticao>): RegraDeRepeticao => ({
  repeat_enabled: true,
  repeat_frequency: "weekly",
  repeat_weekdays: [0],
  repeat_day_of_month: null,
  repeat_time: "07:00",
  ...r,
});
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe("proximaExecucao", () => {
  it("não repetindo, não há próxima", () => {
    expect(proximaExecucao(regra({ repeat_enabled: false }), new Date(), SP)).toBeNull();
  });

  it("semanal na segunda às 7h: de quinta, a próxima é a segunda seguinte", () => {
    const depois = new Date("2026-10-08T12:00:00Z"); // quinta 09:00 em SP
    expect(iso(proximaExecucao(regra({}), depois, SP))).toBe("2026-10-12T10:00:00.000Z");
  });

  it("semanal: na própria segunda, antes das 7h, é hoje; depois das 7h, a semana que vem", () => {
    expect(iso(proximaExecucao(regra({}), new Date("2026-10-12T09:00:00Z"), SP))).toBe(
      "2026-10-12T10:00:00.000Z",
    );
    expect(iso(proximaExecucao(regra({}), new Date("2026-10-12T10:00:00Z"), SP))).toBe(
      "2026-10-19T10:00:00.000Z",
    );
  });

  it("semanal em vários dias (segunda e quinta)", () => {
    const r = regra({ repeat_weekdays: [0, 3] });
    expect(iso(proximaExecucao(r, new Date("2026-10-08T12:00:00Z"), SP))).toBe(
      "2026-10-12T10:00:00.000Z",
    );
    expect(iso(proximaExecucao(r, new Date("2026-10-08T09:00:00Z"), SP))).toBe(
      "2026-10-08T10:00:00.000Z",
    );
  });

  it("semanal sem nenhum dia marcado não repete", () => {
    expect(proximaExecucao(regra({ repeat_weekdays: [] }), new Date(), SP)).toBeNull();
  });

  it("diária: hoje se ainda não deu a hora, senão amanhã", () => {
    const r = regra({ repeat_frequency: "daily" });
    expect(iso(proximaExecucao(r, new Date("2026-10-08T09:00:00Z"), SP))).toBe(
      "2026-10-08T10:00:00.000Z",
    );
    expect(iso(proximaExecucao(r, new Date("2026-10-08T11:00:00Z"), SP))).toBe(
      "2026-10-09T10:00:00.000Z",
    );
  });

  it("mensal: dia 15; e dia 31 cai no último dia dos meses curtos", () => {
    const r = regra({ repeat_frequency: "monthly", repeat_day_of_month: 15 });
    expect(iso(proximaExecucao(r, new Date("2026-10-08T12:00:00Z"), SP))).toBe(
      "2026-10-15T10:00:00.000Z",
    );
    expect(iso(proximaExecucao(r, new Date("2026-10-16T12:00:00Z"), SP))).toBe(
      "2026-11-15T10:00:00.000Z",
    );
    const fim = regra({ repeat_frequency: "monthly", repeat_day_of_month: 31 });
    // depois de 31/10 vem 30/11 (novembro só tem 30)
    expect(iso(proximaExecucao(fim, new Date("2026-11-01T12:00:00Z"), SP))).toBe(
      "2026-11-30T10:00:00.000Z",
    );
    // fevereiro de 2027 tem 28
    expect(iso(proximaExecucao(fim, new Date("2027-02-01T12:00:00Z"), SP))).toBe(
      "2027-02-28T10:00:00.000Z",
    );
  });

  it("vira o ano", () => {
    const r = regra({ repeat_frequency: "monthly", repeat_day_of_month: 5 });
    expect(iso(proximaExecucao(r, new Date("2026-12-20T12:00:00Z"), SP))).toBe(
      "2027-01-05T10:00:00.000Z",
    );
  });

  it("usa o fuso da organização: às 23h de domingo em SP já é 02h de segunda em UTC", () => {
    // domingo 2026-10-11 23:00 em SP = 2026-10-12T02:00Z. A segunda 07:00 SP (10:00Z) ainda vem.
    expect(iso(proximaExecucao(regra({}), new Date("2026-10-12T02:00:00Z"), SP))).toBe(
      "2026-10-12T10:00:00.000Z",
    );
  });
});

describe("tarefaDoModelo", () => {
  const base = "2026-10-08";
  const modelo = {
    title: "Revisar campanhas",
    description: "Ver o gasto",
    priority: "high" as const,
    status_option_id: null,
    assigned_to: "11111111-1111-4111-8111-111111111111",
    start_offset_days: null,
    due_offset_days: 3,
    due_time: null,
  };

  it("prazo relativo, só a data (meia-noite do fuso)", () => {
    const t = tarefaDoModelo(modelo, base, SP);
    expect(t.title).toBe("Revisar campanhas");
    expect(t.priority).toBe("high");
    expect(t.assigned_to).toBe(modelo.assigned_to);
    expect(t.due_date).toBe("2026-10-11T03:00:00.000Z");
    expect(t.start_date).toBeUndefined();
  });

  it("com horário e início", () => {
    const t = tarefaDoModelo({ ...modelo, due_time: "17:30", start_offset_days: 0 }, base, SP);
    expect(t.due_date).toBe("2026-10-11T20:30:00.000Z");
    expect(t.start_date).toBe("2026-10-08T03:00:00.000Z");
  });

  it("sem prazo no modelo, a tarefa nasce sem prazo", () => {
    const t = tarefaDoModelo({ ...modelo, due_offset_days: null }, base, SP);
    expect(t.due_date).toBeUndefined();
  });
});

describe("modeloSchema", () => {
  const ok = { name: "Semanal", title: "Rotina" };

  it("aceita o mínimo e preenche os padrões", () => {
    const r = modeloSchema.parse(ok);
    expect(r.priority).toBe("medium");
    expect(r.repeat_enabled).toBe(false);
    expect(r.repeat_time).toBe("07:00");
    expect(r.repeat_weekdays).toEqual([]);
  });

  it("repetir exige a frequência, e cada frequência exige o seu dado", () => {
    expect(modeloSchema.safeParse({ ...ok, repeat_enabled: true }).success).toBe(false);
    expect(
      modeloSchema.safeParse({ ...ok, repeat_enabled: true, repeat_frequency: "weekly" }).success,
    ).toBe(false);
    expect(
      modeloSchema.safeParse({
        ...ok,
        repeat_enabled: true,
        repeat_frequency: "weekly",
        repeat_weekdays: [4, 0, 0],
      }).data?.repeat_weekdays,
    ).toEqual([0, 4]);
    expect(
      modeloSchema.safeParse({ ...ok, repeat_enabled: true, repeat_frequency: "monthly" }).success,
    ).toBe(false);
    expect(
      modeloSchema.safeParse({
        ...ok,
        repeat_enabled: true,
        repeat_frequency: "monthly",
        repeat_day_of_month: 31,
      }).success,
    ).toBe(true);
  });

  it("recusa horário inválido", () => {
    expect(modeloSchema.safeParse({ ...ok, repeat_time: "25:00" }).success).toBe(false);
    expect(modeloSchema.safeParse({ ...ok, due_time: "9h" }).success).toBe(false);
  });
});
