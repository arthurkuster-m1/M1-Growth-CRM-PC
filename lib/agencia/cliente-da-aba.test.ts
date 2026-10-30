import { afterEach, describe, expect, it } from "vitest";

import { clienteDaAgenciaParaUrl, definirClienteDaAgencia, liberarClienteDaAgencia } from "./cliente-da-aba";

afterEach(() => definirClienteDaAgencia(null));

describe("cliente do modo agência no navegador", () => {
  it("só carimba as rotas que sabem atender outro cliente", () => {
    definirClienteDaAgencia("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/cronograma/semana?inicio=2026-10-25")).toBe("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/dashboards/trafego?de=2026-10-01")).toBe("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/demand-campaigns")).toBe("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/leads")).toBeNull();
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/pages/x")).toBeNull();
  });
  it("sem cliente definido, não carimba nada", () => {
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/cronograma")).toBeNull();
  });
  it("ao trocar de cliente, o desmonte do antigo não apaga o id do novo", () => {
    definirClienteDaAgencia("antigo");
    definirClienteDaAgencia("novo"); // o provedor novo renderiza primeiro…
    liberarClienteDaAgencia("antigo"); // …e o antigo limpa depois
    expect(clienteDaAgenciaParaUrl("/api/v1/dashboards/trafego")).toBe("novo");
    liberarClienteDaAgencia("novo");
    expect(clienteDaAgenciaParaUrl("/api/v1/dashboards/trafego")).toBeNull();
  });
});
