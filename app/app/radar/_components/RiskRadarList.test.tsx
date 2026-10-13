// app/app/radar/_components/RiskRadarList.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { RiskRadarList, destinoDaDemandaSemPasso } from "./RiskRadarList";
import { useAtRiskLeads } from "@/hooks/leads/useAtRiskLeads";

vi.mock("@/hooks/leads/useAtRiskLeads", () => ({ useAtRiskLeads: vi.fn() }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (chave: string) => chave }));
vi.mock("@/hooks/inbox/useClaimConversation", () => ({
  useClaimConversation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const BASE = {
  items: [],
  counts: { critico: 0, em_risco: 0, em_voo: 0 },
  total: 0,
  sem_proximo_passo: [],
  total_sem_proximo_passo: 0,
};

describe("RiskRadarList — demanda sem próximo passo clicável (#2035 · Parte 1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("item VIRA LINK para a conversa vigente quando ela existe", async () => {
    vi.mocked(useAtRiskLeads).mockReturnValue({
      data: {
        ...BASE,
        sem_proximo_passo: [
          {
            id: "d1",
            contact_id: "c1",
            contact_name: "Ana",
            aberta_em: "2026-09-01T00:00:00Z",
            horas_aberta: 30,
            origem: "handoff",
            conversation_id: "conv-1",
          },
        ],
      },
      isLoading: false,
    } as never);
    render(<RiskRadarList />);
    expect(await screen.findByTestId("radar-sem-passo-link")).toHaveAttribute(
      "href",
      "/app/inbox?id=conv-1",
    );
  });

  it("sem conversa, o item VIRA LINK para a ficha do contato", async () => {
    vi.mocked(useAtRiskLeads).mockReturnValue({
      data: {
        ...BASE,
        sem_proximo_passo: [
          {
            id: "d2",
            contact_id: "c2",
            contact_name: "Bruno",
            aberta_em: "2026-09-01T00:00:00Z",
            horas_aberta: 30,
            origem: "inbound",
            conversation_id: null,
          },
        ],
      },
      isLoading: false,
    } as never);
    render(<RiskRadarList />);
    expect(await screen.findByTestId("radar-sem-passo-link")).toHaveAttribute(
      "href",
      "/app/contacts/c2",
    );
  });

  it("o resolver puro escolhe inbox se há conversa, ficha se não há", () => {
    expect(destinoDaDemandaSemPasso({ contact_id: "c1", conversation_id: "conv-9" })).toBe(
      "/app/inbox?id=conv-9",
    );
    expect(destinoDaDemandaSemPasso({ contact_id: "c1", conversation_id: null })).toBe(
      "/app/contacts/c1",
    );
  });
});
