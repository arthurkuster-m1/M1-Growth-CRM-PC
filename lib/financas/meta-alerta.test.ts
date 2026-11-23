import { describe, expect, it } from "vitest";

import { calcularAlertaMeta, type CobrancaDoAlerta } from "./meta-alerta";

const agora = new Date("2026-11-20T12:00:00Z");
const c = (
  cobrada_em: string,
  estado: CobrancaDoAlerta["estado"],
  valor_cents: number | null = 1000,
) => ({
  cobrada_em,
  estado,
  valor_cents,
});
const semConta = { status: 1, lidoEm: "2026-11-20T11:00:00Z" };

describe("calcularAlertaMeta", () => {
  it("sem cobrança e conta ativa: sem alerta", () => {
    expect(calcularAlertaMeta([], semConta, agora)).toBeNull();
  });
  it("conta com pagamento pendente lida há pouco: alerta", () => {
    expect(calcularAlertaMeta([], { status: 3, lidoEm: "2026-11-20T11:00:00Z" }, agora)?.tipo).toBe(
      "pagamento_pendente",
    );
  });
  it("situação 3 antiga (leitura parada há 3 dias) não vale: pode já ter sido resolvida", () => {
    expect(calcularAlertaMeta([], { status: 3, lidoEm: "2026-11-17T11:00:00Z" }, agora)).toBeNull();
  });
  it("recusada recente sem pagamento depois: alerta com data e valor", () => {
    expect(
      calcularAlertaMeta([c("2026-11-19T10:00:00Z", "recusada", 5000)], semConta, agora),
    ).toEqual({
      tipo: "recusada",
      em: "2026-11-19T10:00:00Z",
      valor_cents: 5000,
    });
  });
  it("paga depois da recusada: resolvido", () => {
    expect(
      calcularAlertaMeta(
        [c("2026-11-19T10:00:00Z", "recusada"), c("2026-11-19T18:00:00Z", "paga")],
        semConta,
        agora,
      ),
    ).toBeNull();
  });
  it("paga ANTES da recusada não resolve", () => {
    expect(
      calcularAlertaMeta(
        [c("2026-11-18T10:00:00Z", "paga"), c("2026-11-19T10:00:00Z", "recusada")],
        semConta,
        agora,
      )?.tipo,
    ).toBe("recusada");
  });
  it("recusada com mais de 7 dias não alerta; estorno não resolve recusa", () => {
    expect(calcularAlertaMeta([c("2026-11-10T10:00:00Z", "recusada")], semConta, agora)).toBeNull();
    expect(
      calcularAlertaMeta(
        [c("2026-11-19T10:00:00Z", "recusada"), c("2026-11-19T11:00:00Z", "estornada")],
        semConta,
        agora,
      )?.tipo,
    ).toBe("recusada");
  });
  it("pagamento pendente tem prioridade sobre recusada", () => {
    expect(
      calcularAlertaMeta(
        [c("2026-11-19T10:00:00Z", "recusada")],
        { status: 3, lidoEm: "2026-11-20T11:00:00Z" },
        agora,
      )?.tipo,
    ).toBe("pagamento_pendente");
  });
});
