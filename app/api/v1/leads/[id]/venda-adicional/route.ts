import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/leads/[id]/venda-adicional — uma venda a mais do MESMO contato no MESMO funil.
 *
 * A venda é o card: duas vendas no mesmo funil são dois cards, cada um na sua etapa. Esta rota
 * cria a segunda oportunidade, na primeira etapa
 * aberta, herdando a origem e o responsável do card de onde partiu. A venda do card nasce por
 * gatilho do banco; quem chama a preenche depois (`PATCH /api/v1/vendas/[id]`).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Lead não encontrado."), 404, { requestId });

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const { data: origem } = await supabase
    .from("crm_leads")
    .select(
      "id, pipeline_id, contact_id, title, source, owner_user_id, owner_kind, owner_agent_id, demand_campaign_id, demand_creative_id, demand_landing_page_id, currency",
    )
    .eq("id", id.data)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!origem) return fail("not_found", t("Lead não encontrado."), 404, { requestId });
  const o = origem as {
    id: string;
    pipeline_id: string;
    contact_id: string | null;
    title: string;
    source: string | null;
    owner_user_id: string | null;
    owner_kind: string | null;
    owner_agent_id: string | null;
    demand_campaign_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
    currency: string | null;
  };
  if (!o.contact_id) {
    return fail(
      "validation_failed",
      t("Este negócio não tem contato: não dá para somar uma venda."),
      422,
      { requestId },
    );
  }

  const { data: etapa } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("organization_id", orgId)
    .eq("pipeline_id", o.pipeline_id)
    .eq("is_won", false)
    .eq("is_lost", false)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!etapa) {
    return fail("validation_failed", t("O funil não tem etapa inicial."), 422, { requestId });
  }

  const { count } = await supabase
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("contact_id", o.contact_id)
    .eq("pipeline_id", o.pipeline_id);

  const { data: criado, error } = await supabase
    .from("crm_leads")
    .insert({
      organization_id: orgId,
      pipeline_id: o.pipeline_id,
      stage_id: (etapa as { id: string }).id,
      contact_id: o.contact_id,
      title: `${o.title.replace(/ · venda \d+$/, "")} · venda ${(count ?? 1) + 1}`.slice(0, 200),
      status: "open",
      source: o.source ?? "manual",
      owner_user_id: o.owner_user_id,
      owner_kind: o.owner_kind,
      owner_agent_id: o.owner_agent_id,
      demand_campaign_id: o.demand_campaign_id,
      demand_creative_id: o.demand_creative_id,
      demand_landing_page_id: o.demand_landing_page_id,
      ...(o.currency ? { currency: o.currency } : {}),
      position_in_stage: Date.now(),
      created_by_user_id: authz.user.id,
    })
    .select("id")
    .single();
  if (error || !criado) {
    return fail("internal_error", t("Erro ao criar a venda adicional."), 500, { requestId });
  }
  const novoId = (criado as { id: string }).id;

  void emitLeadActivity(supabase, {
    organizationId: orgId,
    leadId: novoId,
    contactId: o.contact_id,
    type: "lead_created",
    sourceModule: "ficha_do_lead",
    actor: { type: "user", id: authz.user.id },
    reason: "Nova venda no mesmo funil",
    payload: { nova_oportunidade: true, de_lead_id: o.id },
  });
  void audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "lead.created",
    resourceType: "crm_leads",
    resourceId: novoId,
    requestId,
    metadata: { nova_oportunidade: true, de_lead_id: o.id },
  });

  return ok(
    { lead_id: novoId, sale_id: novoId },
    { requestId, status: 201 },
  );
}
