// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";

import { GET, PUT } from "./route";

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: vi.fn(async () => null) }));
vi.mock("@/lib/marketing/campanhas-servidor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/marketing/campanhas-servidor")>()),
  autorizarCampanhas: vi.fn(),
}));

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ctx = { params: Promise.resolve({ id: ID, approachId: AB }) };

function supabaseFake(opts: { abordagem: boolean; antigos?: string[] }) {
  const inseridos: Array<Record<string, unknown>> = [];
  const apagados: string[][] = [];
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
    c.maybeSingle = async () => ({ data: opts.abordagem ? { id: AB } : null });
    c.insert = async (linhas: Array<Record<string, unknown>>) => {
      inseridos.push(...linhas);
      return { error: null };
    };
    c.delete = () => ({
      eq: () => ({
        in: async (_: string, ids: string[]) => {
          apagados.push(ids);
          return { error: null };
        },
      }),
    });
    c.then = (ok: (v: unknown) => void) =>
      ok({
        data: tabela === "demand_approach_steps" ? (opts.antigos ?? []).map((id) => ({ id })) : [],
      });
    return c;
  };
  return { cliente: { from } as never, inseridos, apagados };
}

function pedido(corpo: unknown) {
  return new NextRequest("http://localhost/x", {
    method: "PUT",
    body: JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}

describe("/approaches/[id]/flow", () => {
  beforeEach(() => vi.mocked(autorizarCampanhas).mockReset());

  it("PUT grava os passos novos na ordem e só depois tira os antigos", async () => {
    const f = supabaseFake({ abordagem: true, antigos: ["velho1"] });
    vi.mocked(autorizarCampanhas).mockResolvedValue({
      ok: true,
      requestId: "r",
      orgId: "o1",
      userId: "u1",
      podeEditar: true,
      t: (s: string) => s,
      supabase: f.cliente,
    } as never);
    const r = await PUT(
      pedido({
        steps: [
          {
            kind: "mensagem",
            body: "Olá",
            ai_personalize: true,
            audio_label: "",
            wait_hours: null,
          },
          { kind: "aguardar", body: "", ai_personalize: true, audio_label: "", wait_hours: 24 },
        ],
      }),
      ctx,
    );
    expect(r.status).toBe(200);
    expect(f.inseridos.map((x) => [x.kind, x.position, x.ai_personalize, x.wait_hours])).toEqual([
      ["mensagem", 0, true, null],
      // IA e prazo só valem no tipo certo: o resto é limpo.
      ["aguardar", 1, false, 24],
    ]);
    expect(f.apagados).toEqual([["velho1"]]);
  });

  it("PUT recusa passo inválido e abordagem de outra campanha", async () => {
    const f = supabaseFake({ abordagem: false });
    vi.mocked(autorizarCampanhas).mockResolvedValue({
      ok: true,
      requestId: "r",
      orgId: "o1",
      userId: "u1",
      podeEditar: true,
      t: (s: string) => s,
      supabase: f.cliente,
    } as never);
    expect((await PUT(pedido({ steps: [{ kind: "pombo" }] }), ctx)).status).toBe(422);
    expect((await PUT(pedido({ steps: [] }), ctx)).status).toBe(404);
    expect(f.inseridos).toHaveLength(0);
  });

  it("GET devolve os passos da abordagem", async () => {
    const f = supabaseFake({ abordagem: true });
    vi.mocked(autorizarCampanhas).mockResolvedValue({
      ok: true,
      requestId: "r",
      orgId: "o1",
      t: (s: string) => s,
      supabase: f.cliente,
    } as never);
    const r = await GET(new NextRequest("http://localhost/x"), ctx);
    expect(r.status).toBe(200);
  });
});
