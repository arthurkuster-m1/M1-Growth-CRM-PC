import { describe, expect, it } from "vitest";

import { prioridadeDaFila, somarDiasUteis } from "./resultados-rapidos";

describe("dias úteis", () => {
  it("pula o fim de semana", () => {
    expect(somarDiasUteis("2026-10-16", 1)).toBe("2026-10-19"); // sexta → segunda
    expect(somarDiasUteis("2026-10-15", 2)).toBe("2026-10-19");
    expect(somarDiasUteis("2026-10-17", 0)).toBe("2026-10-19"); // sábado → segunda
  });
});

describe("fila do dia", () => {
  const agora = Date.parse("2026-10-15T15:00:00Z");
  const base = { status: "open", proxima_acao_em: null, ultima_atividade: null, criado_em: "2026-10-14T10:00:00Z" };
  it("próxima ação vencida ou de hoje entra, futura não", () => {
    expect(prioridadeDaFila({ ...base, proxima_acao_em: "2026-10-14" }, "2026-10-15", agora)).not.toBeNull();
    expect(prioridadeDaFila({ ...base, proxima_acao_em: "2026-10-15" }, "2026-10-15", agora)).not.toBeNull();
    expect(prioridadeDaFila({ ...base, proxima_acao_em: "2026-10-16" }, "2026-10-15", agora)).toBeNull();
  });
  it("sem data entra só com 24h ou mais sem resposta", () => {
    expect(prioridadeDaFila(base, "2026-10-15", agora)).not.toBeNull();
    expect(
      prioridadeDaFila({ ...base, ultima_atividade: "2026-10-15T10:00:00Z" }, "2026-10-15", agora),
    ).toBeNull();
  });
  it("vencidas vêm antes das sem data, e fechadas ficam fora", () => {
    const vencida = prioridadeDaFila({ ...base, proxima_acao_em: "2026-10-10" }, "2026-10-15", agora)!;
    const semData = prioridadeDaFila(base, "2026-10-15", agora)!;
    expect(vencida).toBeLessThan(semData);
    expect(prioridadeDaFila({ ...base, status: "lost" }, "2026-10-15", agora)).toBeNull();
  });
});
