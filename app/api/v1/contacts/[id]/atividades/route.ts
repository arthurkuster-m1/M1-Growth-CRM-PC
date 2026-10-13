import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/contacts/[id]/atividades — registra à mão uma ação no histórico do cliente
 * (ligação + resultado, mensagem enviada, remarcou…). Entra na Linha do tempo da ficha.
 *
 * A linha do tempo é ancorada num negócio (`lead_id` é NOT NULL): vale o negócio informado ou,
 * sem ele, o negócio mais recente do contato.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { IDS_DAS_ACOES, textoDaAcao } from "@/lib/leads/acoes-do-lead";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  acao: z.enum(IDS_DAS_ACOES),
  resultado: z.string().trim().max(200).optional(),
  comentario: z.string().trim().max(800).optional(),
  lead_id: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const contactId = z.string().uuid().safeParse((await ctx.params).id);
  if (!contactId.success) return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const orgId = authz.org.orgId;

  const { data: contato } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId.data)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  let query = supabase
    .from("crm_leads")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId.data)
    .order("created_at", { ascending: false })
    .limit(1);
  if (corpo.data.lead_id) query = query.eq("id", corpo.data.lead_id);
  const { data: lead } = await query.maybeSingle();
  if (!lead) {
    return fail(
      "validation_failed",
      t("Este contato ainda não está em nenhum funil — coloque-o num funil para registrar ações."),
      422,
      { requestId },
    );
  }

  const r = await emitLeadActivity(supabase, {
    organizationId: orgId,
    leadId: (lead as { id: string }).id,
    contactId: contactId.data,
    type: "note",
    sourceModule: "ficha_do_lead",
    actor: { type: "user", id: authz.user.id },
    reason: textoDaAcao(corpo.data.acao, corpo.data.resultado, corpo.data.comentario),
    payload: {
      acao: corpo.data.acao,
      resultado: corpo.data.resultado ?? null,
      comentario: corpo.data.comentario ?? null,
    },
  });
  if (!r.ok) return fail("internal_error", t("Erro ao registrar a ação."), 500, { requestId });

  // A última atividade do cliente passa a ser esta.
  await supabase
    .from("contacts")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", contactId.data)
    .eq("organization_id", orgId);

  return ok({ registrado: true }, { requestId, status: 201 });
}
