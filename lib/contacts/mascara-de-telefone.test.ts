import { describe, expect, it } from "vitest";

import { mascararTelefone as m, proximoTelefone as p } from "./mascara-de-telefone";

describe("máscara do telefone", () => {
  it("monta o DDD, o espaço e o traço enquanto digita", () => {
    expect(m("1")).toBe("(1");
    expect(m("119")).toBe("(11) 9");
    expect(m("1193535")).toBe("(11) 9353-5");
    expect(m("11935353353")).toBe("(11) 93535-3353");
    expect(m("1133334444")).toBe("(11) 3333-4444");
  });
  it("limita a 11 dígitos e aceita colar formatado", () => {
    expect(m("119353533535")).toBe("(11) 93535-3353");
    expect(m("(11) 99999-8888")).toBe("(11) 99999-8888");
  });
  it("número com + fica como digitado", () => {
    expect(m("+351 912 345 678")).toBe("+351 912 345 678");
  });
  it("apagar o traço apaga o dígito antes dele", () => {
    expect(p("(11) 93535-3", "(11) 93535")).toBe("(11) 9353-5");
    expect(p("(11) 9353-5", "(11) 9353-")).toBe("(11) 9353");
  });
});
