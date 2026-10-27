import { describe, expect, it } from "vitest";

import { statusDoCompromisso } from "./PaginaDoCompromisso";

describe("status único do compromisso", () => {
  const base = { remarcado_para: null as string | null };
  it("junta situação e resultado: quem compareceu mostra se comprou", () => {
    expect(statusDoCompromisso({ ...base, status: "completed" }, true).rotulo).toBe(
      "Compareceu e Comprou",
    );
    expect(statusDoCompromisso({ ...base, status: "completed" }, false).rotulo).toBe(
      "Compareceu e Não comprou",
    );
  });
  it("aguardando, confirmado e não compareceu", () => {
    expect(statusDoCompromisso({ ...base, status: "pending" }, false).rotulo).toBe(
      "Aguardando confirmação",
    );
    expect(statusDoCompromisso({ ...base, status: "confirmed" }, false).rotulo).toBe("Confirmado");
    expect(statusDoCompromisso({ ...base, status: "no_show" }, false).rotulo).toBe(
      "Não compareceu",
    );
  });
  it("o compromisso que foi remarcado mostra Remarcado, mesmo sendo uma falta no banco", () => {
    expect(statusDoCompromisso({ status: "no_show", remarcado_para: "novo" }, false).rotulo).toBe(
      "Remarcado",
    );
  });
});
