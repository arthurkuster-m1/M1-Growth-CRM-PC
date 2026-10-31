import { describe, expect, it } from "vitest";

import { destinoAoTrocarDeOrganizacao as d } from "./destino-ao-trocar-de-organizacao";

describe("destino ao trocar de organização", () => {
  it("mantém a mesma página", () => {
    expect(d("/app/tarefas")).toBe("/app/tarefas");
    expect(d("/app/crm")).toBe("/app/crm");
  });
  it("ficha com id volta para a lista", () => {
    expect(d("/app/crm/leads/3f0c2a52-1b7e-4f5a-9d3c-0a1b2c3d4e5f")).toBe("/app/crm/leads");
  });
  it("modo agência, raiz e fora do app vão para a Inbox", () => {
    expect(d("/app/agencia/tarefas")).toBe("/app/inbox");
    expect(d("/app")).toBe("/app/inbox");
    expect(d(null)).toBe("/app/inbox");
    expect(d("/login")).toBe("/app/inbox");
  });
});
