import { afterEach, describe, expect, it } from "vitest";

import { clienteDaAgenciaParaUrl, definirClienteDaAgencia } from "./cliente-da-aba";

afterEach(() => definirClienteDaAgencia(null));

describe("cliente do modo agência no navegador", () => {
  it("só carimba as rotas do cronograma", () => {
    definirClienteDaAgencia("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/cronograma/semana?inicio=2026-10-25")).toBe("c1");
    expect(clienteDaAgenciaParaUrl("/api/v1/leads")).toBeNull();
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/pages/x")).toBeNull();
  });
  it("sem cliente definido, não carimba nada", () => {
    expect(clienteDaAgenciaParaUrl("/api/v1/marketing/cronograma")).toBeNull();
  });
});
