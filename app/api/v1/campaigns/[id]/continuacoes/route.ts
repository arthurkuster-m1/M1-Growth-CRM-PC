/**
 * GET /api/v1/campaigns/:id/continuacoes — onde está o fluxo da conversa de cada lead do disparo:
 * quem espera resposta, quem tem mensagem proposta para aprovar, quem foi para o atendente. Gestão lê.
 */
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import { listarContinuacoes } from "@/lib/campanhas/fluxo-da-conversa";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("campanha_nao_encontrada", "Campanha não encontrada.", 404, {
      requestId: "sem-id",
    });
  }
  const a = await autorizarRevisao(createAdminClient(), id, false);
  if (!a.ok) return a.response;
  return ok(await listarContinuacoes(a.admin, a.campanha), { requestId: a.requestId });
}
