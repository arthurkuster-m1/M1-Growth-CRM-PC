/**
 * POST /api/v1/campaigns/:id/continuacoes/:recipientId/:acao — a pessoa decide sobre a mensagem que
 * o fluxo da abordagem propôs depois da resposta do lead: `enviar` (com o texto que viu, editado ou
 * não — `{ corpo }`), `pular`, `reescrever` (a IA escreve de novo) ou `parar` o fluxo daquele lead.
 * Nada sai sem esta decisão. Gestão.
 */
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizarRevisao } from "@/lib/campanhas/autorizar-revisao";
import {
  enviarProposta,
  pararFluxo,
  pularProposta,
  reescreverProposta,
} from "@/lib/campanhas/fluxo-da-conversa";

export const dynamic = "force-dynamic";

const ACOES = ["enviar", "pular", "reescrever", "parar"] as const;
const corpoSchema = z.object({ corpo: z.string().max(4096).optional() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; recipientId: string; acao: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const { id, recipientId, acao } = await ctx.params;
  const acaoValida = z.enum(ACOES).safeParse(acao);
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(recipientId).success ||
    !acaoValida.success
  ) {
    return fail("campanha_nao_encontrada", "Campanha não encontrada.", 404, {
      requestId: "sem-id",
    });
  }
  const a = await autorizarRevisao(createAdminClient(), id, true, false);
  if (!a.ok) return a.response;
  // Defesa em profundidade: o client admin ignora RLS, então a campanha carregada tem de ser da
  // organização da sessão antes de qualquer escrita.
  if (a.campanha.organization_id !== a.orgId) {
    return fail("campanha_nao_encontrada", a.t("Campanha não encontrada."), 404, {
      requestId: a.requestId,
    });
  }
  const corpo = corpoSchema.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const alvo = { organizationId: a.orgId, campaignId: id, recipientId };
  const r =
    acaoValida.data === "enviar"
      ? await enviarProposta(a.admin, { ...alvo, corpo: corpo.data.corpo })
      : acaoValida.data === "pular"
        ? await pularProposta(a.admin, alvo)
        : acaoValida.data === "reescrever"
          ? await reescreverProposta(a.admin, alvo)
          : await pararFluxo(a.admin, alvo);
  if (!r.ok) {
    return fail(
      r.status === 409
        ? "campanha_estado_invalido"
        : r.status === 503
          ? "unavailable"
          : "validation_failed",
      a.t(r.mensagem),
      r.status,
      { requestId: a.requestId },
    );
  }
  void audit({
    action: `campaign.flow_${acaoValida.data}`,
    actorUserId: a.userId,
    organizationId: a.orgId,
    resourceType: "campaign",
    resourceId: id,
    requestId: a.requestId,
    metadata: { recipient_id: recipientId },
  });
  return ok({ feito: acaoValida.data }, { requestId: a.requestId });
}
