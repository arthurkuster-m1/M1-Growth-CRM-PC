import { beforeEach, describe, expect, it, vi } from "vitest";

const entrega = (destinatarios: string[]) => ({
  destinatarios,
  aviso: { categoria: "mensagem", titulo: "Maria", corpo: "oi", acoes: [], tag: "conversa:c1" },
});

const montar = {
  mensagem: vi.fn(async (..._a: unknown[]) => entrega(["u-1"]) as unknown),
  grupo: vi.fn(async (..._a: unknown[]) => entrega(["u-1"]) as unknown),
  leadNovo: vi.fn(async (..._a: unknown[]) => entrega(["u-2"]) as unknown),
  leadAtribuido: vi.fn(async (..._a: unknown[]) => entrega(["u-3"]) as unknown),
  mencao: vi.fn(async (..._a: unknown[]) => entrega(["u-4"]) as unknown),
  central: vi.fn(async (..._a: unknown[]) => null as unknown),
};
vi.mock("./montar-avisos", () => ({
  montarAvisoDeMensagem: (...a: unknown[]) => montar.mensagem(...a),
  montarAvisoDeGrupo: (...a: unknown[]) => montar.grupo(...a),
  montarAvisoDeLeadNovo: (...a: unknown[]) => montar.leadNovo(...a),
  montarAvisoDeLeadAtribuido: (...a: unknown[]) => montar.leadAtribuido(...a),
  montarAvisoDeMencao: (...a: unknown[]) => montar.mencao(...a),
  montarAvisoDaCentral: (...a: unknown[]) => montar.central(...a),
}));

const entregar = vi.fn(async (..._a: unknown[]) => ({ gravadas: 1, push: 1 }));
vi.mock("./entregar-notificacao", () => ({
  entregarNotificacao: (...a: unknown[]) => entregar(...a),
}));
vi.mock("@/lib/channels/desativado", () => ({ canalDoEventoDesativado: async () => false }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { webPushInboundHandler } from "./push.handler";

function row(event_type: string, over: Record<string, unknown> = {}) {
  return {
    id: "ev-1",
    organization_id: "org1",
    event_type,
    entity_kind: "x",
    entity_id: "ent-1",
    payload: {},
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...over,
  };
}

describe("webPushInboundHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assina mensagem, lead novo, lead atribuído, menção e avisos da Central — e não mais ganho/perdido", () => {
    expect(webPushInboundHandler.events).toEqual([
      "message.received",
      "message.group_received",
      "lead.created",
      "lead.assigned",
      "user.mentioned",
      "central.aviso_criado",
    ]);
  });

  it("entrega a notificação montada, com o id do evento para não repetir no reprocessamento", async () => {
    const r = await webPushInboundHandler.handle(
      row("message.received", { payload: { conversation_id: "c1" } }),
    );
    expect(r.status).toBe("ok");
    expect(entregar).toHaveBeenCalledTimes(1);
    expect(entregar.mock.calls[0]![1]).toBe("org1");
    expect(entregar.mock.calls[0]![3]).toBe("ev-1");
  });

  it("lead novo usa o id da entidade; lead atribuído passa quem recebeu", async () => {
    await webPushInboundHandler.handle(
      row("lead.created", { entity_id: "lead-9", metadata: { via: "planilha" } }),
    );
    expect(montar.leadNovo.mock.calls[0]!.slice(1)).toEqual([
      "org1",
      "lead-9",
      { via: "planilha" },
    ]);
    await webPushInboundHandler.handle(
      row("lead.assigned", { payload: { lead_id: "lead-9", to_user_id: "u-3" } }),
    );
    expect(montar.leadAtribuido.mock.calls[0]!.slice(1)).toEqual(["org1", "lead-9", "u-3"]);
  });

  it("nada a avisar (aviso que fica só na Central) → skipped, nada entregue", async () => {
    const r = await webPushInboundHandler.handle(
      row("central.aviso_criado", { payload: { item_id: "av-1" } }),
    );
    expect(r).toMatchObject({ status: "skipped", detail: "ninguem_a_avisar" });
    expect(entregar).not.toHaveBeenCalled();
  });
});
