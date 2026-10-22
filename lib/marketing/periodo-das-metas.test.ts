import { describe, expect, it } from "vitest";

import { periodoDasMetas } from "./campanhas";

describe("periodoDasMetas", () => {
  it("campanha com início e fim vale pela campanha toda", () => {
    expect(periodoDasMetas({ continuous: false, end_date: "2026-12-31" })).toBe("total");
  });
  it("contínua renova todo mês, mesmo com data final guardada", () => {
    expect(periodoDasMetas({ continuous: true, end_date: "2026-12-31" })).toBe("mensal");
    expect(periodoDasMetas({ continuous: true, end_date: null })).toBe("mensal");
  });
  it("sem data final também renova todo mês", () => {
    expect(periodoDasMetas({ continuous: false, end_date: null })).toBe("mensal");
  });
});
