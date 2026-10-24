// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/impersonate/support")>()),
  requireSupportWrite: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTATO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ABORDAGEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function supabaseFake(tagsAtuais: string[] = []) {
  const atividades: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    let modo: "select" | "update" = "select";
    c.select = () => c;
    c.eq = () => c;
    c.order = () => c;
    c.limit = () => c;
    c.insert = (linha: Record<string, unknown>) => {
      if (tabela === "crm_lead_activities") atividades.push(linha);
      return Promise.resolve({ error: null });
    };
    c.update = (patch: Record<string, unknown>) => {
      modo = "update";
      updates.push(patch);
      return c;
    };
    c.maybeSingle = async () => {
      if (tabela === "contacts") return { data: { id: CONTATO, tags: tagsAtuais }, error: null };
      if (tabela === "crm_leads") return { data: { id: LEAD }, error: null };
      if (tabela === "demand_campaign_approaches")
        return { data: { id: ABORDAGEM, name: "Cold call" }, error: null };
      return { data: null, error: null };
    };
    c.then = (ok: (v: unknown) => void) => ok({ data: null, error: null, modo });
    return c;
  };
  return { cliente: { from } as never, atividades, updates };
}

function pedido(corpo: unknown) {
  return new NextRequest(`http://localhost/api/v1/contacts/${CONTATO}/atividades`, {
    method: "POST",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}
const ctx = { params: Promise.resolve({ id: CONTATO }) };

describe("POST /contacts/[id]/atividades", () => {
  beforeEach(() => {
    vi.mocked(requireRole).mockResolvedValue({
      ok: true,
      user: { id: "u1", idioma: "pt-BR" },
      org: { orgId: ORG },
    } as never);
  });

  it("'Outra ação' sem título é recusada", async () => {
    const f = supabaseFake();
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    const r = await POST(pedido({ acao: "outro", comentario: "algo" }), ctx);
    expect(r.status).toBe(422);
    expect(f.atividades).toHaveLength(0);
  });

  it("'Outra ação' com título entra, e o título vai no payload", async () => {
    const f = supabaseFake();
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    const r = await POST(pedido({ acao: "outro", titulo: "Visitou a loja" }), ctx);
    expect(r.status).toBe(201);
    expect((f.atividades[0]!.payload as { titulo: string }).titulo).toBe("Visitou a loja");
    expect(f.atividades[0]!.reason).toBe("");
  });

  it("abordagem com o decisor: põe Contato, Contato com decisor e a abordagem usada — e o histórico diz quais", async () => {
    const f = supabaseFake(["quente"]);
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    const r = await POST(
      pedido({
        acao: "ligacao",
        resultado: "Atendeu — falou com o decisor",
        abordagem_id: ABORDAGEM,
      }),
      ctx,
    );
    expect(r.status).toBe(201);
    expect(f.updates.find((u) => u.tags)?.tags).toEqual([
      "quente",
      "Contato",
      "Contato com decisor",
      "Abordagem: Cold call",
    ]);
    expect((f.atividades[0]!.payload as { tags_automaticas: string[] }).tags_automaticas).toEqual([
      "Contato",
      "Contato com decisor",
      "Abordagem: Cold call",
    ]);
  });

  it("segunda abordagem igual: o contador da abordagem sobe e 'Contato' não repete", async () => {
    const f = supabaseFake(["Contato", "Contato com decisor", "Abordagem: Cold call"]);
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    await POST(
      pedido({
        acao: "ligacao",
        resultado: "Atendeu — falou com o decisor",
        abordagem_id: ABORDAGEM,
      }),
      ctx,
    );
    expect(f.updates.find((u) => u.tags)?.tags).toEqual([
      "Contato",
      "Contato com decisor",
      "Abordagem: Cold call: 2x",
    ]);
  });

  it("sem resposta só marca a abordagem usada; ação sem resultado (remarcou, reunião) não põe tag automática", async () => {
    const f = supabaseFake([]);
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    await POST(
      pedido({ acao: "mensagem", resultado: "Sem resposta", abordagem_id: ABORDAGEM }),
      ctx,
    );
    expect(f.updates.find((u) => u.tags)?.tags).toEqual(["Abordagem: Cold call"]);

    const g = supabaseFake([]);
    vi.mocked(createClient).mockResolvedValue(g.cliente);
    await POST(pedido({ acao: "reuniao", resultado: "Atendeu — falou com o decisor" }), ctx);
    expect(g.updates.some((u) => u.tags)).toBe(false);
    expect((g.atividades[0]!.payload as Record<string, unknown>).tags_automaticas).toBeUndefined();
  });

  it("a tag da ação soma com contador (segunda vez = 2x)", async () => {
    const f = supabaseFake(["No Show"]);
    vi.mocked(createClient).mockResolvedValue(f.cliente);
    const r = await POST(pedido({ acao: "no_show", tag: "No Show" }), ctx);
    expect(r.status).toBe(201);
    const corpo = (await r.json()) as { data: { tag: string } };
    expect(corpo.data.tag).toBe("No Show: 2x");
    expect(f.updates.some((u) => JSON.stringify(u.tags) === JSON.stringify(["No Show: 2x"]))).toBe(
      true,
    );
  });
});
