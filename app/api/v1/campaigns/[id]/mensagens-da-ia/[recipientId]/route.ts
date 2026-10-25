/**
 * PATCH /api/v1/campaigns/:id/mensagens-da-ia/:recipientId — a pessoa edita a mensagem de um lead
 * (`{ corpo }`) ou o tira da lista (`{ excluir: true }`). Derruba a aprovação. Gestão.
 */
import { z } from "zod";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail, ok } from "@/lib/api/wrappers";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import { editarMensagemDaIA } from "@/lib/campanhas/mensagens-da-ia";

export const dynamic = "force-dynamic";

const corpoSchema = z
  .object({ corpo: z.string().max(4096).optional(), excluir: z.literal(true).optional() })
  .refine((v) => v.corpo !== undefined || v.excluir === true, { message: "Nada para alterar." });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; recipientId: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const { id, recipientId } = await ctx.params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(recipientId).success
  ) {
    return fail("campanha_nao_encontrada", "Campanha não encontrada.", 404, {
      requestId: "sem-id",
    });
  }
  const a = await autorizarRevisao(id, true);
  if (!a.ok) return a.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const r = await editarMensagemDaIA(a.admin, a.campanha, recipientId, corpo.data);
  if (!r.ok) {
    return fail(r.status === 404 ? "not_found" : "validation_failed", a.t(r.mensagem), r.status, {
      requestId: a.requestId,
    });
  }
  return ok({ editada: true }, { requestId: a.requestId });
}
