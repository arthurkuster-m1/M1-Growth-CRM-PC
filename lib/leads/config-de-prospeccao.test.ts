import { describe, expect, it } from "vitest";

import {
  CONFIG_PADRAO_DA_PROSPECCAO,
  resultadosAtivosDaConfig,
  resultadosPadraoDoTipo,
} from "./config-de-prospeccao";

describe("resultados da prospecção", () => {
  it("WhatsApp não traz Caixa postal nem Não atendeu", () => {
    const rotulos = resultadosPadraoDoTipo("whatsapp").map((r) => r.rotulo);
    expect(rotulos).not.toContain("Caixa postal");
    expect(rotulos).not.toContain("Não atendeu");
  });
  it("só os ativos e com nome entram, na ordem dos atalhos", () => {
    const c = {
      ...CONFIG_PADRAO_DA_PROSPECCAO,
      tipo: "whatsapp" as const,
      resultadosPorTipo: {
        ...CONFIG_PADRAO_DA_PROSPECCAO.resultadosPorTipo,
        whatsapp: [
          { id: "a", rotulo: "Visualizou", ativo: true },
          { id: "b", rotulo: "Oculto", ativo: false },
          { id: "c", rotulo: " ", ativo: true },
          { id: "d", rotulo: "Marcou call", ativo: true },
        ],
      },
    };
    expect(resultadosAtivosDaConfig(c).map((r) => r.rotulo)).toEqual(["Visualizou", "Marcou call"]);
  });
});

import { prioridadeDaFila } from "@/lib/leads/resultados-rapidos";

describe("fila Ligar hoje com a cadência", () => {
  const lead = {
    status: "open",
    proxima_acao_em: null,
    ultima_atividade: new Date().toISOString(),
    criado_em: new Date().toISOString(),
  };
  it("passo da cadência de hoje entra na fila e na frente de quem só tem ação vencida", () => {
    const agora = Date.now();
    const doDia = prioridadeDaFila(lead, "2026-10-28", agora, undefined, 0);
    const vencida = prioridadeDaFila(
      { ...lead, proxima_acao_em: "2026-10-20" },
      "2026-10-28",
      agora,
      undefined,
      null,
    );
    expect(doDia).not.toBeNull();
    expect(vencida).not.toBeNull();
    expect(doDia!).toBeLessThan(vencida!);
  });
  it("desligada nas configurações, a cadência não entra", () => {
    const fila = { ...CONFIG_PADRAO_DA_PROSPECCAO.fila, cadencia: false };
    expect(prioridadeDaFila(lead, "2026-10-28", Date.now(), fila, 0)).toBeNull();
  });
});
