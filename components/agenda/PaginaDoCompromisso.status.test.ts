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
      "Não confirmado",
    );
    expect(statusDoCompromisso({ ...base, status: "confirmed" }, false).rotulo).toBe("Confirmado");
    expect(statusDoCompromisso({ ...base, status: "no_show" }, false).rotulo).toBe(
      "Não compareceu",
    );
  });
  it("o compromisso remarcado é uma falta no banco e mostra Não compareceu", () => {
    expect(statusDoCompromisso({ status: "no_show", remarcado_para: "novo" }, false).rotulo).toBe(
      "Não compareceu",
    );
  });
});
