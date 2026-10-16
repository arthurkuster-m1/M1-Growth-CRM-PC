/**
 * POST /api/v1/demand-campaigns/[id]/leads-em-lote — coloca contatos do CRM no funil da campanha
 * (manager+). Cada um vira um lead na primeira etapa do funil, já ligado à campanha. Quem já tem
 * negócio aberto nesse funil é pulado.
 *
 * É o que faz uma campanha de Reativação de Base: seleciona os leads no CRM, cria a campanha e
 * eles já entram no funil novo.
 */
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
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

  // O lead reaproveitado MANTÉM a origem pela qual entrou (campanha, anúncio e página da 1ª
  // oportunidade dele): a campanha nova é dona do funil e do faturamento, mas a origem do cliente
  // continua sendo a de tráfego que o trouxe.
  const origemDoCliente = new Map<
    string,
    { demand_campaign_id: string | null; demand_creative_id: string | null; demand_landing_page_id: string | null }
  >();
  for (let i = 0; i < novos.length; i += 200) {
    const { data } = await a.supabase
      .from("crm_leads")
      .select("contact_id, demand_campaign_id, demand_creative_id, demand_landing_page_id, created_at")
      .eq("organization_id", a.orgId)
      .in("contact_id", novos.slice(i, i + 200).map((c) => c.id))
      .order("created_at", { ascending: true })
      .limit(5000);
    for (const l of (data ?? []) as Array<{
      contact_id: string;
      demand_campaign_id: string | null;
      demand_creative_id: string | null;
      demand_landing_page_id: string | null;
    }>) {
      if (!l.demand_campaign_id || origemDoCliente.has(l.contact_id)) continue;
      origemDoCliente.set(l.contact_id, {
        demand_campaign_id: l.demand_campaign_id,
        demand_creative_id: l.demand_creative_id,
        demand_landing_page_id: l.demand_landing_page_id,
      });
    }
  }
  let adicionados = 0;
  for (let i = 0; i < novos.length; i += 100) {
    const lote = novos.slice(i, i + 100).map((c, k) => ({
      organization_id: a.orgId,
      pipeline_id: pipelineId,
      stage_id: etapaId,
      contact_id: c.id,
      title: (nomeDoContato(c) ?? c.phone_number ?? "Lead").slice(0, 200),
      status: "open",
      source: "reativacao",
      demand_campaign_id: origemDoCliente.get(c.id)?.demand_campaign_id ?? id,
      demand_creative_id: origemDoCliente.get(c.id)?.demand_creative_id ?? null,
      demand_landing_page_id: origemDoCliente.get(c.id)?.demand_landing_page_id ?? null,
      position_in_stage: (i + k + 1) * 1000,
      created_by_user_id: a.userId,
    }));
    const { data: criados, error } = await a.supabase
      .from("crm_leads")
      .insert(lote)
      .select("id, contact_id");
    // A participação entra na linha do tempo: "entrou no funil X", com o nome da campanha.
    for (const l of (criados ?? []) as Array<{ id: string; contact_id: string }>) {
      void emitLeadActivity(a.supabase, {
        organizationId: a.orgId,
        leadId: l.id,
        contactId: l.contact_id,
        type: "lead_created",
        sourceModule: "campanhas",
        actor: { type: "user", id: a.userId },
        reason: `Entrou no funil da campanha ${campanha.name as string}`,
        payload: { campanha_id: id, reaproveitado: true },
      });
    }
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
