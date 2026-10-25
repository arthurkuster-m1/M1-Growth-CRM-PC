/**
 * GET /api/v1/campaigns/:id/mensagens-da-ia — o estado das mensagens que a IA escreve para os
 * leads do disparo: se o disparo usa IA, o resumo, o custo, a aprovação e as mensagens dos
 * primeiros leads (o teto inicial é 20). Gestão lê.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import { revisaoDasMensagens } from "@/lib/campanhas/mensagens-da-ia";

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
  const a = await autorizarRevisao(id, false);
  if (!a.ok) return a.response;
  return ok(await revisaoDasMensagens(a.admin, a.campanha), { requestId: a.requestId });
}
