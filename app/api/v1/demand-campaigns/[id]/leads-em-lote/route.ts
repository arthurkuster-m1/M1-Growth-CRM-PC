/**
 * POST /api/v1/demand-campaigns/[id]/leads-em-lote — coloca contatos do CRM no funil da campanha
 * (manager+). Cada um vira um lead na primeira etapa do funil, já ligado à campanha. Quem já tem
 * negócio aberto nesse funil é pulado.
 *
 * É o que faz uma campanha de Reativação de Base: seleciona os leads no CRM, cria a campanha e
 * eles já entram no funil novo.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const corpoSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(1000),
});

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const ids = [...new Set(corpo.data.contact_ids)];

  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id, name, pipeline_id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);
  const pipelineId = campanha.pipeline_id as string | null;
  if (!pipelineId) {
    return fail(
      "validation_failed",
      a.t("Crie o funil da campanha antes de colocar leads nela."),
      422,
      {
        requestId: a.requestId,
      },
    );
  }

  const { data: etapas } = await a.supabase
    .from("crm_stages")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("pipeline_id", pipelineId)
    .eq("is_won", false)
    .eq("is_lost", false)
    .eq("is_archived", false)
    .order("position", { ascending: true })
    .limit(1);
  const etapaId = (etapas?.[0] as { id: string } | undefined)?.id;
  if (!etapaId) {
    return fail("validation_failed", a.t("O funil da campanha não tem etapa inicial."), 422, {
      requestId: a.requestId,
    });
  }

  const contatos: Array<{
    id: string;
    name: string | null;
    display_name: string | null;
    phone_number: string | null;
  }> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await a.supabase
      .from("contacts")
      .select("id, name, display_name, phone_number")
      .eq("organization_id", a.orgId)
      .in("id", ids.slice(i, i + 200));
    contatos.push(...((data ?? []) as typeof contatos));
  }

  const jaNoFunil = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await a.supabase
      .from("crm_leads")
      .select("contact_id")
      .eq("organization_id", a.orgId)
      .eq("pipeline_id", pipelineId)
      .eq("status", "open")
      .in("contact_id", ids.slice(i, i + 200));
    for (const l of (data ?? []) as Array<{ contact_id: string }>) jaNoFunil.add(l.contact_id);
  }

  const novos = contatos.filter((c) => !jaNoFunil.has(c.id));
  let adicionados = 0;
  for (let i = 0; i < novos.length; i += 100) {
    const lote = novos.slice(i, i + 100).map((c, k) => ({
      organization_id: a.orgId,
      pipeline_id: pipelineId,
      stage_id: etapaId,
      contact_id: c.id,
      title: (c.name ?? c.display_name ?? c.phone_number ?? "Lead").slice(0, 200),
      status: "open",
      source: "reativacao",
      demand_campaign_id: id,
      position_in_stage: (i + k + 1) * 1000,
      created_by_user_id: a.userId,
    }));
    const { error } = await a.supabase.from("crm_leads").insert(lote);
    if (error) {
      return fail("internal_error", a.t("Erro ao colocar os leads no funil."), 500, {
        requestId: a.requestId,
        details: { adicionados },
      });
    }
    adicionados += lote.length;
  }

  void audit({
    organizationId: a.orgId,
    actorUserId: a.userId,
    action: "lead.origem_changed",
    resourceType: "demand_campaigns",
    resourceId: id,
    requestId: a.requestId,
    metadata: { leads_em_lote: adicionados, pulados: ids.length - adicionados },
  });

  return ok(
    { adicionados, pulados: ids.length - adicionados, pipeline_id: pipelineId },
    { requestId: a.requestId, status: 201 },
  );
}
