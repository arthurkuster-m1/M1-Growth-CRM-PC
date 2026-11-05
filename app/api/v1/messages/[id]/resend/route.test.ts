import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /messages/[id]/resend — a mensagem de uma pessoa presa com o número fora do ar.
 * Garantias: só a que espera reenvio; número ainda fora do ar não reserva nada; a reserva é
 * condicional (dois cliques não enviam duas vezes); o envio é o do handler, sobre a MESMA linha
 * (`internalMessageId`); se não saiu, volta a `queued`; se saiu, audita.
 */
const h = vi.hoisted(() => {
  class ApiErroFalso extends Error {
    constructor(
      public status: number,
      public code: string,
      msg: string,
    ) {
      super(msg);
    }
  }
  return {
    ApiErroFalso,
    linha: null as Record<string, unknown> | null,
    sessao: { status: "WORKING" } as { status: string } | null,
    reservou: true,
    atualizacoes: [] as Array<{
      valores: Record<string, unknown>;
      filtros: Array<[string, unknown]>;
    }>,
    handler: vi.fn(),
    audit: vi.fn(),
  };
});

vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: async () => null }));
vi.mock("@/lib/audit", () => ({ audit: h.audit }));
vi.mock("@/lib/api/types", () => ({ ApiError: h.ApiErroFalso }));
vi.mock("@/lib/i18n/dicionario", () => ({ traduzir: (s: string) => s }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: async () => ({
    ok: true,
    user: { id: "user-1", idioma: "pt-BR" },
    org: { orgId: "org-1" },
  }),
}));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: h.handler }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      const filtros: Array<[string, unknown]> = [];
      let valores: Record<string, unknown> | null = null;
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.update = (v: Record<string, unknown>) => {
        valores = v;
        return c;
      };
      c.eq = (col: string, val: unknown) => {
        filtros.push([col, val]);
        return c;
      };
      c.maybeSingle = async () => ({
        data: tabela === "messages" ? h.linha : { id: "conv-1", channel_sessions: h.sessao },
        error: null,
      });
      c.then = (ok: (r: unknown) => unknown) => {
        if (valores) h.atualizacoes.push({ valores, filtros });
        const reserva = valores?.status === "sending";
        return Promise.resolve({
          data: reserva ? (h.reservou ? [{ id: "m1" }] : []) : [],
          error: null,
        }).then(ok);
      };
      return c;
    },
  }),
}));

import { POST } from "./route";

const ID = "11111111-0000-4000-8000-000000000001";
const ctx = { params: Promise.resolve({ id: ID }) };
const pedido = () =>
  new NextRequest(`http://localhost/api/v1/messages/${ID}/resend`, { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  h.atualizacoes = [];
  h.reservou = true;
  h.sessao = { status: "WORKING" };
  h.linha = {
    id: ID,
    conversation_id: "conv-1",
    type: "text",
    body: "Oi, tudo bem?",
    media_url: null,
    media_mime: null,
    media_storage_path: null,
    media_size_bytes: null,
    reply_to_message_id: null,
    direction: "outbound",
    status: "queued",
    sent_via: "user",
    metadata: { queued_reason: "channel_session_not_working" },
  };
  h.handler.mockResolvedValue({
    id: ID,
    status: "sent",
    metadata: { queued_reason: "channel_session_not_working" },
  });
});

describe("POST /messages/[id]/resend", () => {
  it("mensagem que não existe → 404; id inválido → 422", async () => {
    h.linha = null;
    expect((await POST(pedido(), ctx)).status).toBe(404);
    expect((await POST(pedido(), { params: Promise.resolve({ id: "x" }) })).status).toBe(422);
  });

  it("só a que espera reenvio: da IA, enviada ou modelo → 409, sem reservar nem enviar", async () => {
    for (const mudanca of [{ sent_via: "ai" }, { status: "sent" }, { type: "template" }]) {
      h.linha = { ...(h.linha as object), ...mudanca };
      const res = await POST(pedido(), ctx);
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("not_resendable");
    }
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.atualizacoes).toEqual([]);
  });

  it("número ainda fora do ar → 409 number_still_offline, e nada é reservado", async () => {
    h.sessao = { status: "FAILED" };
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("number_still_offline");
    expect(h.handler).not.toHaveBeenCalled();
    expect(h.atualizacoes).toEqual([]);
  });

  it("reserva condicional: se outro clique já reservou, não envia de novo", async () => {
    h.reservou = false;
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(409);
    expect(h.handler).not.toHaveBeenCalled();
    // A reserva só vale se a linha AINDA está `queued`, na organização certa.
    const reserva = h.atualizacoes[0]!;
    expect(reserva.valores).toEqual({ status: "sending" });
    expect(reserva.filtros).toEqual(
      expect.arrayContaining([
        ["status", "queued"],
        ["organization_id", "org-1"],
        ["id", ID],
      ]),
    );
  });

  it("envia pelo handler sobre a MESMA linha, limpa o motivo e audita", async () => {
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(200);
    expect(h.handler).toHaveBeenCalledTimes(1);
    const [, contexto, entrada] = h.handler.mock.calls[0]!;
    expect(contexto).toMatchObject({
      organization_id: "org-1",
      actor: { type: "user", id: "user-1" },
      internalMessageId: ID,
    });
    expect(entrada).toEqual({ conversation_id: "conv-1", type: "text", body: "Oi, tudo bem?" });
    // o motivo da fila sai da linha: a tela não pode mais dizer "fora do ar"
    const limpeza = h.atualizacoes.find((a) => "metadata" in a.valores);
    expect(limpeza?.valores.metadata).toEqual({});
    expect(h.audit.mock.calls[0]?.[0]).toMatchObject({
      action: "message.resent",
      organizationId: "org-1",
      resourceId: ID,
    });
  });

  it("o handler deixou na fila de novo → volta a `queued`, 409 e sem auditoria", async () => {
    h.handler.mockResolvedValue({ id: ID, status: "queued", metadata: {} });
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(409);
    expect(h.atualizacoes.some((a) => a.valores.status === "queued")).toBe(true);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("o handler lançou → volta a `queued` e devolve o erro dele", async () => {
    h.handler.mockRejectedValue(new h.ApiErroFalso(403, "forbidden", "sem acesso"));
    const res = await POST(pedido(), ctx);
    expect(res.status).toBe(403);
    expect(h.atualizacoes.some((a) => a.valores.status === "queued")).toBe(true);
  });
});
