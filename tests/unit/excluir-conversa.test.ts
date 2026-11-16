/**
 * DELETE /api/v1/conversations/[id] — excluir a conversa do Inbox e escolher o que acontece com o
 * lead: só a conversa (o lead continua cadastrado) ou o lead inteiro (mesmo caminho da exclusão de
 * leads do CRM, que leva tudo para a Lixeira por 7 dias).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE } from "@/app/api/v1/conversations/[id]/route";
import { deleteContactHandler } from "@/app/api/v1/contacts/_handler";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn(), orgAtivaDaApi: vi.fn() }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(async () => null) }));
vi.mock("@/lib/users/com-nome-do-atendente", () => ({
  comNomeDoAtendente: vi.fn(async (l: unknown[]) => l),
}));
vi.mock("@/app/api/v1/contacts/_handler", () => ({ deleteContactHandler: vi.fn() }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const CONV_ID = "44444444-4444-4444-8444-444444444444";
const CONTACT_ID = "55555555-5555-4555-8555-555555555555";

interface Estado {
  conversa: { id: string; contact_id: string | null } | null;
  apagouConversa: boolean;
  mensagens: number;
}

function supabaseFalso(e: Estado) {
  return {
    from: (tabela: string) => {
      const chain: Record<string, unknown> = {};
      let apagando = false;
      Object.assign(chain, {
        select: (_c?: string, opts?: { head?: boolean }) => {
          if (tabela === "messages" && opts?.head) {
            return { eq: () => ({ eq: () => Promise.resolve({ count: e.mensagens }) }) };
          }
          return chain;
        },
        delete: () => {
          apagando = true;
          return chain;
        },
        eq: () => chain,
        maybeSingle: () => {
          if (apagando) {
            e.apagouConversa = !!e.conversa;
            return Promise.resolve({ data: e.conversa ? { id: CONV_ID } : null, error: null });
          }
          return Promise.resolve({ data: e.conversa, error: null });
        },
      });
      return chain;
    },
  };
}

const requisicao = (corpo?: unknown) =>
  new Request("http://x/api/v1/conversations/" + CONV_ID, {
    method: "DELETE",
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }) as never;
const ctx = (id = CONV_ID) => ({ params: Promise.resolve({ id }) });

let estado: Estado;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSupportWrite).mockResolvedValue(null);
  estado = {
    conversa: { id: CONV_ID, contact_id: CONTACT_ID },
    apagouConversa: false,
    mensagens: 12,
  };
  vi.mocked(createClient).mockResolvedValue(supabaseFalso(estado) as never);
  vi.mocked(requireRole).mockResolvedValue({
    ok: true,
    user: { id: USER_ID, idioma: "pt-BR" },
    org: { orgId: ORG_ID },
  } as never);
});

describe("DELETE /api/v1/conversations/[id]", () => {
  it("sem escolha, apaga SÓ a conversa: o lead não é tocado e fica a auditoria", async () => {
    const r = await DELETE(requisicao({}), ctx());
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ conversa_apagada: true, lead_apagado: false });
    expect(estado.apagouConversa).toBe(true);
    expect(deleteContactHandler).not.toHaveBeenCalled();
    const entrada = vi.mocked(audit).mock.calls[0]![0];
    expect(entrada.action).toBe("conversation.deleted");
    expect(entrada.metadata).toMatchObject({
      contact_id: CONTACT_ID,
      mensagens: 12,
      lead_mantido: true,
    });
  });

  it("com apagar_lead, exclui o lead inteiro pelo mesmo caminho do CRM (Lixeira) e não apaga a conversa à parte", async () => {
    vi.mocked(deleteContactHandler).mockResolvedValue({ id: CONTACT_ID });
    const r = await DELETE(requisicao({ apagar_lead: true }), ctx());
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ conversa_apagada: true, lead_apagado: true });
    expect(deleteContactHandler).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteContactHandler).mock.calls[0]![2]).toBe(CONTACT_ID);
    expect(estado.apagouConversa).toBe(false);
  });

  it("apagar o lead de uma conversa sem lead é recusado", async () => {
    estado.conversa = { id: CONV_ID, contact_id: null };
    const r = await DELETE(requisicao({ apagar_lead: true }), ctx());
    expect(r.status).toBe(422);
    expect(deleteContactHandler).not.toHaveBeenCalled();
  });

  it("conversa que não existe (ou fora do acesso) dá 404 e nada é apagado", async () => {
    estado.conversa = null;
    const r = await DELETE(requisicao({}), ctx());
    expect(r.status).toBe(404);
    expect(audit).not.toHaveBeenCalled();
  });

  it("id que não é uuid dá 404; corpo inválido dá 422", async () => {
    expect((await DELETE(requisicao({}), ctx("undefined"))).status).toBe(404);
    expect((await DELETE(requisicao({ apagar_lead: "sim" }), ctx())).status).toBe(422);
  });

  it("sessão de suporte somente leitura não exclui", async () => {
    vi.mocked(requireSupportWrite).mockResolvedValue(new Response("{}", { status: 403 }) as never);
    const r = await DELETE(requisicao({}), ctx());
    expect(r.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("quem não é atendente não passa (a autorização vem antes de tudo)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: false,
      response: new Response("{}", { status: 403 }),
    } as never);
    const r = await DELETE(requisicao({}), ctx());
    expect(r.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });
});
