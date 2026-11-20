/**
 * Quem desligou uma categoria "no celular" (migration 0698) não recebe o push dela — mas a
 * notificação continua gravada para o sino. E o mesmo evento reprocessado não empurra de novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enviados = vi.fn(async (_org: string, _users: readonly string[], _payload: unknown) => ({
  sent: 1,
  gone: 0,
}));
vi.mock("@/lib/notifications/web_push", () => ({
  enviarPushAosUsuarios: (org: string, users: readonly string[], payload: unknown) =>
    enviados(org, users, payload),
}));

import { entregarNotificacao } from "@/lib/notifications/entregar-notificacao";

function banco(opts: { jaEntregues?: string[]; desligaram?: string[] }) {
  const gravadas: Array<Record<string, unknown>> = [];
  const admin = {
    from(tabela: string) {
      if (tabela === "notificacoes") {
        return {
          upsert(linhas: Array<Record<string, unknown>>) {
            const novas = linhas.filter(
              (l) => !(opts.jaEntregues ?? []).includes(l.user_id as string),
            );
            gravadas.push(...novas);
            return {
              select: async () => ({
                data: novas.map((l) => ({ user_id: l.user_id })),
                error: null,
              }),
            };
          },
        };
      }
      // notificacoes_preferencias
      const q = {
        select: () => q,
        eq: () => q,
        in: async () => ({
          data: (opts.desligaram ?? []).map((user_id) => ({ user_id })),
          error: null,
        }),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { admin, gravadas };
}

const entrega = {
  destinatarios: ["ana", "bia"],
  aviso: {
    categoria: "lead_novo" as const,
    titulo: "Novo lead: Maria",
    corpo: "",
    acoes: [{ rotulo: "Abrir no CRM", href: "/app/leads/l1" }],
    tag: "lead:l1",
  },
};

describe("entregarNotificacao", () => {
  beforeEach(() => enviados.mockClear());

  it("grava para os dois, mas só empurra para quem não desligou o celular", async () => {
    const { admin, gravadas } = banco({ desligaram: ["bia"] });
    await entregarNotificacao(admin, "org-1", entrega, "ev-1");
    expect(gravadas.map((g) => g.user_id)).toEqual(["ana", "bia"]);
    expect(enviados.mock.calls[0]![1]).toEqual(["ana"]);
  });

  it("evento reprocessado: quem já recebeu não recebe de novo", async () => {
    const { admin } = banco({ jaEntregues: ["ana"] });
    await entregarNotificacao(admin, "org-1", entrega, "ev-1");
    expect(enviados.mock.calls[0]![1]).toEqual(["bia"]);
  });
});
