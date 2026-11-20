import { describe, expect, it } from "vitest";

import { regraParaDiagrama, TITULO_DA_IA_DECIDE } from "@/lib/automation/regra-para-diagrama";

const rotulos = {
  gatilho: (id: string) => `G:${id}`,
  acao: (id: string) => `A:${id}`,
};

describe("regraParaDiagrama", () => {
  it("encadeia Quando → Se → Então de cima para baixo", () => {
    const d = regraParaDiagrama(
      {
        trigger_event: "lead.created",
        conditions: [{ field: "lead.tags", op: "contains", value: "Google" }],
        actions: [
          { type: "add_tag", config: { tags: ["Novo"] } },
          { type: "create_task", config: { titulo: "Ligar" } },
        ],
      },
      rotulos,
    );
    expect(d.nos.map((n) => n.tipo)).toEqual(["gatilho", "condicao", "acao", "acao"]);
    expect(d.nos.map((n) => n.y)).toEqual([0, 130, 260, 390]);
    expect(d.arestas.map((a) => [a.de, a.para])).toEqual([
      ["gatilho", "se-1"],
      ["se-1", "acao-2"],
      ["acao-2", "acao-3"],
    ]);
    expect(d.nos[2]?.detalhe).toBe("Novo");
  });

  it("regra sem condição nem ação é só o gatilho, sem setas", () => {
    const d = regraParaDiagrama(
      { trigger_event: "lead.won", conditions: [], actions: [] },
      rotulos,
    );
    expect(d.nos).toHaveLength(1);
    expect(d.arestas).toEqual([]);
  });

  it("a IA decide abre uma seta rotulada por opção, e a coluna principal segue", () => {
    const d = regraParaDiagrama(
      {
        trigger_event: "message.received",
        conditions: [],
        actions: [
          {
            type: "ai_decide",
            config: {
              custo_de_token: true,
              instrucao: "Decida o destino",
              opcoes: [
                { id: "a", rotulo: "Quer comprar", acao: { type: "add_tag", config: {} } },
                { id: "b", rotulo: "Só curiosidade", acao: { type: "create_task", config: {} } },
              ],
            },
          },
          { type: "assign_owner", config: {} },
        ],
      },
      rotulos,
    );
    const ia = d.nos.find((n) => n.tipo === "ia");
    expect(ia?.titulo).toBe(TITULO_DA_IA_DECIDE);
    expect(ia?.detalhe).toBe("Decida o destino");
    const saidas = d.arestas.filter((a) => a.de === ia?.id && a.rotulo);
    expect(saidas.map((a) => a.rotulo)).toEqual(["Quer comprar", "Só curiosidade"]);
    expect(d.nos.filter((n) => n.x > 0).map((n) => n.titulo)).toEqual([
      "A:add_tag",
      "A:create_task",
    ]);
    // a coluna principal continua depois da IA
    expect(d.arestas.some((a) => a.de === ia?.id && a.para === "acao-2" && !a.rotulo)).toBe(true);
  });

  it("ignora opção malformada da IA sem quebrar", () => {
    const d = regraParaDiagrama(
      {
        trigger_event: "lead.created",
        conditions: [],
        actions: [{ type: "ai_decide", config: { opcoes: [null, { rotulo: "x" }, 3] } }],
      },
      rotulos,
    );
    expect(d.nos).toHaveLength(2);
  });
});
