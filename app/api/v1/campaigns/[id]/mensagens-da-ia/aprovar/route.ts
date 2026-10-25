/**
 * POST /api/v1/campaigns/:id/mensagens-da-ia/aprovar — a pessoa aprova as mensagens da IA como
 * estão. Sem isso o disparo não inicia nem agenda. Só com todas prontas e dentro do teto. Gestão.
 */
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import { aprovarMensagensDaIA } from "@/lib/campanhas/mensagens-da-ia";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
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
  const a = await autorizarRevisao(createAdminClient(), id, true);
  if (!a.ok) return a.response;
  // Defesa em profundidade: o client admin ignora RLS, então a campanha carregada tem de ser da
  // organização da sessão antes de qualquer escrita.
  if (a.campanha.organization_id !== a.orgId) {
    return fail("campanha_nao_encontrada", a.t("Campanha não encontrada."), 404, {
      requestId: a.requestId,
    });
  }
  const r = await aprovarMensagensDaIA(a.admin, a.campanha, a.userId, new Date());
  if (!r.ok)
    return fail("campanha_mensagens_nao_aprovadas", a.t(r.mensagem), r.status, {
      requestId: a.requestId,
    });
  void audit({
    action: "campaign.ai_messages_approved",
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "campaign",
    resourceId: id,
    requestId: a.requestId,
    metadata: {},
  });
  return ok({ aprovada: true }, { requestId: a.requestId });
}
