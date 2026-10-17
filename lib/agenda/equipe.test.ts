import { describe, expect, it } from "vitest";

import { escolherOMenosCarregado, type AtendenteLivre } from "./equipe";

const a = (user_id: string, carga: number, priority = 100): AtendenteLivre => ({ user_id, carga, priority, google: true });

describe("escolherOMenosCarregado", () => {
  it("pega quem tem menos compromissos no dia", () => {
    expect(escolherOMenosCarregado([a("ana", 3), a("beto", 1), a("cris", 2)])?.user_id).toBe("beto");
  });
  it("na mesma carga, vale a prioridade (número menor primeiro)", () => {
    expect(escolherOMenosCarregado([a("ana", 2, 200), a("beto", 2, 50)])?.user_id).toBe("beto");
  });
  it("ninguém livre: nada para escolher", () => {
    expect(escolherOMenosCarregado([])).toBeNull();
  });
});
