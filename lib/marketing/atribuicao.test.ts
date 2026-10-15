import { describe, expect, it } from "vitest";

import { campanhaDaOportunidade } from "./atribuicao";

const campanhas = [
  { id: "A", pipeline_id: "fA" },
  { id: "R", pipeline_id: "fR" },
];

describe("campanhaDaOportunidade", () => {
  it("a campanha dona do funil vence a de origem (reativação)", () => {
    expect(campanhaDaOportunidade({ pipeline_id: "fR", demand_campaign_id: "A" }, campanhas)).toBe("R");
  });
  it("sem dono do funil, vale a origem", () => {
    expect(campanhaDaOportunidade({ pipeline_id: "fX", demand_campaign_id: "A" }, campanhas)).toBe("A");
  });
  it("no próprio funil da origem, é a mesma campanha", () => {
    expect(campanhaDaOportunidade({ pipeline_id: "fA", demand_campaign_id: "A" }, campanhas)).toBe("A");
  });
  it("funil de campanha com origem vazia: é da dona do funil", () => {
    expect(campanhaDaOportunidade({ pipeline_id: "fR", demand_campaign_id: null }, campanhas)).toBe("R");
  });
  it("sem nada, sem campanha", () => {
    expect(campanhaDaOportunidade({ pipeline_id: null, demand_campaign_id: null }, campanhas)).toBeNull();
  });
});
