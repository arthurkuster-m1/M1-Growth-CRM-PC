import { describe, expect, it } from "vitest";

import { passosDaRegra } from "./passos-da-regra";

const rotulos = { gatilho: (i: string) => `G:${i}`, acao: (i: string) => `A:${i}` };

describe("passos da regra", () => {
  it("conta a regra em ordem: gatilho, condições, ações", () => {
    const p = passosDaRegra(
      {
        trigger_event: "lead.silent_for",
        trigger_config: { dias: 2, unidade: "dias" },
        conditions: [{ field: "contact.tags", op: "contains", value: "vip" }],
        actions: [
          { type: "add_tag", config: { tags: ["a", "b"] } },
          { type: "create_task", config: { titulo: "Ligar", vence_em_dias: 0 } },
          {
            type: "call_webhook",
            config: { url: "https://n8n.exemplo.com/hook/abc?token=segredo" },
          },
        ],
      },
      rotulos,
    );
    expect(p.map((x) => x.tipo)).toEqual(["gatilho", "condicao", "acao", "acao", "acao"]);
    expect(p[0]).toMatchObject({ titulo: "G:lead.silent_for", detalhe: "2 dias" });
    expect(p[1]!.titulo).toBe("Só se Tags do contato contém “vip”");
    expect(p[2]!.detalhe).toBe("a, b");
    expect(p[3]!.detalhe).toBe("Ligar · vence no mesmo dia");
  });
  it("do webhook mostra só o endereço, nunca o caminho nem o token", () => {
    const p = passosDaRegra(
      {
        trigger_event: "lead.created",
        conditions: [],
        actions: [
          {
            type: "call_webhook",
            config: { url: "https://n8n.exemplo.com/hook/abc?token=segredo" },
          },
        ],
      },
      rotulos,
    );
    expect(p[1]!.detalhe).toBe("n8n.exemplo.com");
    expect(JSON.stringify(p)).not.toContain("segredo");
  });
});
