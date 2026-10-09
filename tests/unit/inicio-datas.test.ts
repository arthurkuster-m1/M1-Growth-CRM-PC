import { describe, expect, it } from "vitest";

import {
  chaveDoDia,
  diaDaSemanaDaChave,
  diasDaSemana,
  inicioDoDia,
  saudacaoDaHora,
  somarDias,
} from "@/lib/inicio/datas";
import { tarefasDoDia } from "@/lib/inicio/tarefas-do-dia";
import type { Tarefa } from "@/lib/tarefas/tipos";

const SP = "America/Sao_Paulo";

describe("datas da tela Início", () => {
  it("o dia é o do FUSO, não o do UTC", () => {
    // 01:00 UTC de 30/07 ainda é 22:00 de 29/07 em São Paulo.
    expect(chaveDoDia(new Date("2026-07-30T01:00:00Z"), SP)).toBe("2026-07-29");
    expect(chaveDoDia(new Date("2026-07-30T03:00:00Z"), SP)).toBe("2026-07-30");
  });

  it("o começo do dia é o instante certo em fusos de lados opostos", () => {
    expect(inicioDoDia("2026-07-30", SP).toISOString()).toBe("2026-07-30T03:00:00.000Z");
    expect(inicioDoDia("2026-07-30", "Asia/Tokyo").toISOString()).toBe("2026-07-29T15:00:00.000Z");
    expect(inicioDoDia("2026-07-30", "UTC").toISOString()).toBe("2026-07-30T00:00:00.000Z");
  });

  it("o começo do dia é uma volta completa: o instante cai no dia pedido, às 00:00", () => {
    for (const fuso of [SP, "Asia/Tokyo", "Europe/Lisbon", "America/New_York"]) {
      const inicio = inicioDoDia("2026-03-08", fuso); // dia de mudança de horário nos EUA
      expect(chaveDoDia(inicio, fuso)).toBe("2026-03-08");
      expect(chaveDoDia(new Date(inicio.getTime() - 1), fuso)).toBe("2026-03-07");
    }
  });

  it("soma dias de calendário atravessando mês e ano", () => {
    expect(somarDias("2026-07-31", 2)).toBe("2026-08-02");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("a semana vai de segunda a domingo — quinta 30/07/2026 → 27/07 a 02/08", () => {
    expect(diaDaSemanaDaChave("2026-07-30")).toBe(3); // quinta
    expect(diaDaSemanaDaChave("2026-07-27")).toBe(0); // segunda
    expect(diaDaSemanaDaChave("2026-08-02")).toBe(6); // domingo
    const semana = diasDaSemana("2026-07-30");
    expect(semana).toHaveLength(7);
    expect(semana[0]).toBe("2026-07-27");
    expect(semana[6]).toBe("2026-08-02");
    // O domingo pertence à semana que TERMINA nele.
    expect(diasDaSemana("2026-08-02")[0]).toBe("2026-07-27");
  });

  it("saudação por hora", () => {
    expect(saudacaoDaHora(0)).toBe("bom_dia");
    expect(saudacaoDaHora(11)).toBe("bom_dia");
    expect(saudacaoDaHora(12)).toBe("boa_tarde");
    expect(saudacaoDaHora(17)).toBe("boa_tarde");
    expect(saudacaoDaHora(18)).toBe("boa_noite");
  });
});

function tarefa(p: Partial<Tarefa> & Pick<Tarefa, "id">): Tarefa {
  return {
    organization_id: "o",
    title: p.id,
    description: null,
    due_date: null,
    priority: "medium",
    status: "pending",
    lead_id: null,
    contact_id: null,
    assigned_to: null,
    created_by: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...p,
  };
}

describe("tarefasDoDia", () => {
  const hoje = "2026-07-30";

  it("separa atrasadas e de hoje, ignora sem prazo, futuras e encerradas", () => {
    const r = tarefasDoDia(
      [
        tarefa({ id: "atrasada", due_date: "2026-07-28T15:00:00Z" }),
        tarefa({ id: "hoje", due_date: "2026-07-30T15:00:00Z" }),
        tarefa({ id: "amanha", due_date: "2026-07-31T15:00:00Z" }),
        tarefa({ id: "sem-prazo" }),
        tarefa({ id: "feita", due_date: "2026-07-30T15:00:00Z", status: "done" }),
        tarefa({ id: "cancelada", due_date: "2026-07-28T15:00:00Z", status: "cancelled" }),
      ],
      hoje,
      SP,
    );
    expect(r.atrasadas.map((t) => t.id)).toEqual(["atrasada"]);
    expect(r.hoje.map((t) => t.id)).toEqual(["hoje"]);
  });

  it("vence hoje às 23h em São Paulo NÃO é atrasada (o UTC já está em amanhã)", () => {
    // 23:00 de 30/07 em SP = 02:00Z de 31/07.
    const r = tarefasDoDia([tarefa({ id: "noite", due_date: "2026-07-31T02:00:00Z" })], hoje, SP);
    expect(r.hoje.map((t) => t.id)).toEqual(["noite"]);
    expect(r.atrasadas).toEqual([]);
  });

  it("ordena: atrasada mais antiga primeiro; hoje por prioridade e depois por hora", () => {
    const r = tarefasDoDia(
      [
        tarefa({ id: "b", due_date: "2026-07-29T15:00:00Z" }),
        tarefa({ id: "a", due_date: "2026-07-27T15:00:00Z" }),
        tarefa({ id: "baixa-cedo", due_date: "2026-07-30T12:00:00Z", priority: "low" }),
        tarefa({ id: "urgente-tarde", due_date: "2026-07-30T20:00:00Z", priority: "urgent" }),
        tarefa({ id: "media-cedo", due_date: "2026-07-30T11:00:00Z" }),
      ],
      hoje,
      SP,
    );
    expect(r.atrasadas.map((t) => t.id)).toEqual(["a", "b"]);
    expect(r.hoje.map((t) => t.id)).toEqual(["urgente-tarde", "media-cedo", "baixa-cedo"]);
  });
});

describe("tarefasDoDia — tarefas com início", () => {
  const hoje = "2026-07-30"; // 04:00Z do dia 30/07 = 01:00 em São Paulo

  it("a tarefa que COMEÇA hoje é do dia, mesmo com prazo adiante ou sem prazo", () => {
    const r = tarefasDoDia(
      [
        tarefa({
          id: "adiante",
          start_date: "2026-07-30T04:00:00Z",
          due_date: "2026-08-10T03:00:00Z",
        }),
        tarefa({ id: "so-inicio", start_date: "2026-07-30T04:00:00Z", due_date: null }),
      ],
      hoje,
      SP,
    );
    expect(r.hoje.map((t) => t.id).sort()).toEqual(["adiante", "so-inicio"]);
  });

  it("a tarefa no MEIO de um intervalo longo não lota o Início", () => {
    const r = tarefasDoDia(
      [
        tarefa({
          id: "projeto",
          start_date: "2026-07-01T03:00:00Z",
          due_date: "2026-08-30T03:00:00Z",
        }),
      ],
      hoje,
      SP,
    );
    expect(r.hoje).toEqual([]);
    expect(r.atrasadas).toEqual([]);
  });

  it("encerrada nunca aparece, nem começando hoje", () => {
    const r = tarefasDoDia(
      [tarefa({ id: "feita", status: "done", start_date: "2026-07-30T04:00:00Z", due_date: null })],
      hoje,
      SP,
    );
    expect(r.hoje).toEqual([]);
  });
});
