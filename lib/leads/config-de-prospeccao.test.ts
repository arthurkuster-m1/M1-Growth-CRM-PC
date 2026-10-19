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
