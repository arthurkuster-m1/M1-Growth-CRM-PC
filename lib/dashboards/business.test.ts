import { describe, expect, it } from "vitest";

import { corteDoAtivo, diasEntreDatas, maisMeses, mediana, ultimosMeses } from "./business";

describe("dashboard Business: contas", () => {
  it("mediana e dias entre datas", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([1, 2, 3, 10])).toBe(2.5);
    expect(mediana([])).toBeNull();
    expect(diasEntreDatas("2026-10-01", "2026-10-19")).toBe(18);
  });
  it("meses e corte de ativo", () => {
    expect(ultimosMeses("2026-10-14", 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(maisMeses("2026-11", 2)).toBe("2027-01");
    expect(corteDoAtivo("2026-10-14", 6)).toBe("2026-04-14");
  });
});
