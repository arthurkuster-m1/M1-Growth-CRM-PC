import { describe, expect, it, vi } from "vitest";

import { getAction } from "@/lib/automation/actions";
import type { ActionCtx } from "@/lib/automation/types";
import "@/lib/automation/actions/add-tag";

vi.mock("@/lib/atendimento/origem-automacao", () => ({
  originFromAutomationEvent: vi.fn(async () => null),
}));

function ctxCom(context: Record<string, unknown>) {
  const updates: Array<{ tabela: string; tags: string[] }> = [];
  const admin = {
    from: (tabela: string) => ({
      update: (v: { tags: string[] }) => {
        updates.push({ tabela, tags: v.tags });
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    }),
    rpc: async () => ({ error: null }),
  };
  const ctx = {
    admin,
    organizationId: "org-1",
    ruleId: "r1",
    ruleName: "R",
    requestId: "e1",
    event: { id: "e1", organization_id: "org-1", event_type: "lead.silent_for", entity_kind: "crm_lead", entity_id: "l1", payload: {}, metadata: {}, consumed_by: [], attempts: 0 },
    context,
  } as unknown as ActionCtx;
  return { ctx, updates };
}

const COM_LEAD_E_CONTATO = {
  lead: { id: "l1", contact_id: "c1", tags: [] },
  contact: { id: "c1", tags: ["velha"] },
};

describe("add_tag: onde a tag fica", () => {
  it("sem `alvo`, no lead quando o evento traz um (o de sempre)", async () => {
    const { ctx, updates } = ctxCom(COM_LEAD_E_CONTATO);
    await getAction("add_tag")!.execute(ctx, { tags: ["x"] });
    expect(updates).toEqual([{ tabela: "crm_leads", tags: ["x"] }]);
  });

  it("com alvo 'contato', no contato — onde a ficha e o filtro do Inbox leem", async () => {
    const { ctx, updates } = ctxCom(COM_LEAD_E_CONTATO);
    await getAction("add_tag")!.execute(ctx, { tags: ["x"], alvo: "contato" });
    expect(updates).toEqual([{ tabela: "contacts", tags: ["velha", "x"] }]);
  });

  it("alvo 'contato' sem contato no contexto cai no lead, em vez de perder a tag", async () => {
    const { ctx, updates } = ctxCom({ lead: { id: "l1", tags: [] } });
    await getAction("add_tag")!.execute(ctx, { tags: ["x"], alvo: "contato" });
    expect(updates).toEqual([{ tabela: "crm_leads", tags: ["x"] }]);
  });
});
