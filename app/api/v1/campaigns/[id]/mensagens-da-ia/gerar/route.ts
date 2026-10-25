/**
 * POST /api/v1/campaigns/:id/mensagens-da-ia/gerar — a IA escreve a abertura de cada lead do
 * disparo preparado (ou só a de um, com `{ recipient_id }`). Derruba a aprovação. Gestão.
 */
import { z } from "zod";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import { gerarMensagensDaIA } from "@/lib/campanhas/mensagens-da-ia";

export const dynamic = "force-dynamic";
// A IA escreve até 20 mensagens, algumas ao mesmo tempo.
export const maxDuration = 120;

const corpoSchema = z.object({ recipient_id: z.string().uuid().optional() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("campanha_nao_encontrada", "Campanha não encontrada.", 404, {
      requestId: "sem-id",
    });
  }
  const a = await autorizarRevisao(id, true);
  if (!a.ok) return a.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const r = await gerarMensagensDaIA(a.admin, a.campanha, { apenas: corpo.data.recipient_id });
  if (!r.ok) return fail(r.codigo, a.t(r.mensagem), r.status, { requestId: a.requestId });
  void audit({
    action: "campaign.ai_messages_generated",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "campaign",
    resourceId: id,
    requestId: a.requestId,
    metadata: { geradas: r.geradas, falhas: r.falhas, custo_cents: r.custo_cents },
  });
  return ok(r, { requestId: a.requestId });
}
