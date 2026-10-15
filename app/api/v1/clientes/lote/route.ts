import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/clientes/lote — edita vários leads do CRM de uma vez (atendente em diante).
 *
 *  - { action: "tags", contact_ids, add: [...] }  → soma tags ao contato
 *  - { action: "origem", contact_ids, campaign_id, creative_id?, landing_page_id?, source? }
 *    → corrige a origem do negócio mais recente de cada contato
 *  - { action: "dono", contact_ids, user_id } → define (ou tira, com null) o dono da PESSOA: quem
 *    cuida do relacionamento. É diferente do dono da oportunidade (quem fecha a venda).
 *  - { action: "excluir", contact_ids } → exclui os contatos (o que tem vínculo que barra fica e
 *    volta em `falhas`)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { deleteContactHandler } from "@/app/api/v1/contacts/_handler";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { normalizarTags } from "@/lib/contacts/tag-normalizada";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const contatos = z.array(z.string().uuid()).min(1).max(500);
const corpoSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("tags"),
    contact_ids: contatos,
    add: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
  }),
  z.object({ action: z.literal("excluir"), contact_ids: contatos }),
  z.object({
    action: z.literal("dono"),
    contact_ids: contatos,
    user_id: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal("origem"),
    contact_ids: contatos,
    campaign_id: z.string().uuid().nullable().optional(),
    creative_id: z.string().uuid().nullable().optional(),
    landing_page_id: z.string().uuid().nullable().optional(),
    source: z.string().trim().min(1).max(80).optional(),
  }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const ids = [...new Set(corpo.data.contact_ids)];

  if (corpo.data.action === "dono") {
    const userId = corpo.data.user_id;
    if (userId) {
      const { data: membro } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .maybeSingle();
      if (!membro) {
        return fail("validation_failed", t("Essa pessoa não é da equipe."), 422, { requestId });
      }
    }
    const { error } = await supabase
      .from("contacts")
      .update({ dono_user_id: userId })
      .eq("organization_id", orgId)
      .in("id", ids);
    if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });
    return ok({ atualizados: ids.length }, { requestId });
  }

  if (corpo.data.action === "excluir") {
    let excluidos = 0;
    const falhas: Array<{ contact_id: string; motivo: string }> = [];
    for (const id of ids) {
      try {
        await deleteContactHandler(
          supabase,
          {
            organization_id: orgId,
            actor: { type: "user", id: authz.user.id },
            requestId,
            idioma: authz.user.idioma,
          },
          id,
        );
        excluidos += 1;
      } catch (err) {
        falhas.push({
          contact_id: id,
          motivo: err instanceof ApiError ? err.message : t("Erro ao excluir."),
        });
      }
    }
    return ok({ excluidos, falhas }, { requestId });
  }

  if (corpo.data.action === "tags") {
    const novas = normalizarTags(corpo.data.add);
    const { data } = await supabase
      .from("contacts")
      .select("id, tags")
      .eq("organization_id", orgId)
      .in("id", ids);
    let atualizados = 0;
    for (const c of (data ?? []) as Array<{ id: string; tags: string[] | null }>) {
      const juntas = [...new Set([...(c.tags ?? []), ...novas])];
      if (juntas.length === (c.tags ?? []).length) continue;
      const { error } = await supabase
        .from("contacts")
        .update({ tags: juntas })
        .eq("id", c.id)
        .eq("organization_id", orgId);
      if (!error) atualizados += 1;
    }
    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "lead.origem_changed",
      resourceType: "contact",
      resourceId: ids[0]!,
      requestId,
      metadata: { lote: "tags", contatos: ids.length, tags: novas },
    });
    return ok({ atualizados }, { requestId });
  }

  const { campaign_id, creative_id, landing_page_id, source } = corpo.data;
  const patch: Record<string, unknown> = {};
  if (campaign_id !== undefined) {
    patch.demand_campaign_id = campaign_id;
    patch.demand_creative_id = campaign_id === null ? null : (creative_id ?? null);
    patch.demand_landing_page_id = campaign_id === null ? null : (landing_page_id ?? null);
    if (campaign_id) {
      const { data: c } = await supabase
        .from("demand_campaigns")
        .select("id")
        .eq("id", campaign_id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!c) return fail("validation_failed", t("Campanha não encontrada."), 422, { requestId });
    }
  }
  if (source !== undefined) patch.source = source;
  if (Object.keys(patch).length === 0) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }

  const { data: negocios } = await supabase
    .from("crm_leads")
    .select("id, contact_id, created_at")
    .eq("organization_id", orgId)
    .in("contact_id", ids)
    .order("created_at", { ascending: false })
    .limit(5000);
  const maisRecente = new Map<string, string>();
  for (const n of (negocios ?? []) as Array<{ id: string; contact_id: string }>) {
    if (!maisRecente.has(n.contact_id)) maisRecente.set(n.contact_id, n.id);
  }
  const leadIds = [...maisRecente.values()];
  let atualizados = 0;
  for (let i = 0; i < leadIds.length; i += 100) {
    const { error } = await supabase
      .from("crm_leads")
      .update(patch)
      .eq("organization_id", orgId)
      .in("id", leadIds.slice(i, i + 100));
    if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });
    atualizados += Math.min(100, leadIds.length - i);
  }
  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "lead.origem_changed",
    resourceType: "contact",
    resourceId: ids[0]!,
    requestId,
    metadata: { lote: "origem", contatos: ids.length, ...patch },
  });
  return ok({ atualizados, sem_negocio: ids.length - leadIds.length }, { requestId });
}
