import { describe, expect, it } from "vitest";

import { analisarCompromissos, type CompromissoParaAnalise } from "./analises";

const agora = Date.parse("2026-10-15T12:00:00Z");
const base: CompromissoParaAnalise = {
  id: "x",
  status: "confirmed",
  starts_at: "2026-10-10T10:00:00Z",
  ends_at: "2026-10-10T10:30:00Z",
  owner_user_id: "u1",
  event_type_id: "t1",
  lead_id: null,
  campaign_id: null,
  vendeu: false,
};
const c = (o: Partial<CompromissoParaAnalise>) => ({ ...base, ...o });
const dia = (iso: string) => iso.slice(0, 10);

describe("análises da agenda", () => {
  const lista = [
    c({ id: "1", status: "completed", lead_id: "L1", vendeu: true, campaign_id: "C1" }),
    c({ id: "2", status: "completed", lead_id: "L2", vendeu: false, campaign_id: "C1" }),
    c({ id: "3", status: "no_show", lead_id: "L3", campaign_id: "C1" }),
    c({ id: "4", status: "cancelled" }),
    c({ id: "5", status: "confirmed" }), // passou e ninguém declarou
    c({ id: "6", status: "confirmed", starts_at: "2026-10-20T10:00:00Z", ends_at: "2026-10-20T10:30:00Z", owner_user_id: "u2" }),
  ];
  const a = analisarCompromissos(lista, dia, agora);

  it("conta cada situação", () => {
    expect(a.totais).toMatchObject({
      agendados: 6,
      compareceram: 2,
      faltaram: 1,
      cancelados: 1,
      semDesfecho: 1,
      proximos: 1,
    });
  });
  it("taxa de comparecimento só usa quem teve desfecho; conversão só quem tinha oportunidade", () => {
    expect(a.totais.taxaDeComparecimento).toBe(66.7); // 2 ÷ (2+1)
    expect(a.totais.taxaDeConversao).toBe(50); // 1 vendeu ÷ 2 compareceram com oportunidade
  });
  it("agrupa por atendente e por campanha", () => {
    expect(a.porAtendente.find((g) => g.id === "u1")!.agendados).toBe(5);
    expect(a.porAtendente.find((g) => g.id === "u2")!.proximos).toBe(1);
    expect(a.porCampanha.find((g) => g.id === "C1")!.compareceram).toBe(2);
  });
  it("sem desfecho não inventa taxa", () => {
    const so = analisarCompromissos([c({ status: "confirmed" })], dia, agora);
    expect(so.totais.taxaDeComparecimento).toBeNull();
  });
});
