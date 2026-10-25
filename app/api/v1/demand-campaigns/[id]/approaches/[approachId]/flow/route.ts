/**
 * GET /api/v1/demand-campaigns/[id]/approaches/[approachId]/flow — o fluxo de conversa da
 *   abordagem de WhatsApp (a empresa lê).
 * PUT /api/v1/demand-campaigns/[id]/approaches/[approachId]/flow — grava o fluxo inteiro (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fluxoDaAbordagemSchema, type PassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";
import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; approachId: string }> };

const uuid = z.string().uuid();
const COLUNAS = "id, position, kind, body, ai_personalize, audio_label, wait_hours";

type Cliente = Extract<Awaited<ReturnType<typeof autorizarCampanhas>>, { ok: true }>["supabase"];

async function abordagemDaCampanha(
  supabase: Cliente,
  orgId: string,
  id: string,
  approachId: string,
) {
  const { data } = await supabase
    .from("demand_campaign_approaches")
    .select("id")
    .eq("organization_id", orgId)
    .eq("campaign_id", id)
    .eq("id", approachId)
    .maybeSingle();
  return Boolean(data);
}

async function lerPassos(supabase: Cliente, orgId: string, approachId: string) {
  const { data } = await supabase
    .from("demand_approach_steps")
    .select(COLUNAS)
    .eq("organization_id", orgId)
    .eq("approach_id", approachId)
    .order("position", { ascending: true })
    .limit(50);
  return ((data ?? []) as Array<PassoDoFluxo & { id: string; position: number }>).map(
    ({ kind, body, ai_personalize, audio_label, wait_hours }) => ({
      kind,
      body,
      ai_personalize,
      audio_label,
      wait_hours,
    }),
  );
}

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id, approachId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(approachId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  if (!(await abordagemDaCampanha(a.supabase, a.orgId, id, approachId))) {
    return fail("not_found", a.t("Abordagem não encontrada."), 404, { requestId: a.requestId });
  }
  return ok(
    { steps: await lerPassos(a.supabase, a.orgId, approachId) },
    { requestId: a.requestId },
  );
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id, approachId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(approachId).success) {
    return campanhaNaoEncontrada(a.t, a.requestId);
  }
  const corpo = fluxoDaAbordagemSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  if (!(await abordagemDaCampanha(a.supabase, a.orgId, id, approachId))) {
    return fail("not_found", a.t("Abordagem não encontrada."), 404, { requestId: a.requestId });
  }
  // Grava os passos novos primeiro e só então tira os antigos: falha no meio não apaga o desenho.
  const { data: antigos } = await a.supabase
    .from("demand_approach_steps")
    .select("id")
    .eq("organization_id", a.orgId)
    .eq("approach_id", approachId);
  const novos = corpo.data.steps.map((s, i) => ({
    ...s,
    wait_hours: s.kind === "aguardar" ? s.wait_hours : null,
    ai_personalize: s.kind === "mensagem" ? s.ai_personalize : false,
    organization_id: a.orgId,
    approach_id: approachId,
    position: i,
  }));
  if (novos.length > 0) {
    const { error } = await a.supabase.from("demand_approach_steps").insert(novos);
    if (error) {
      return fail("internal_error", a.t("Erro ao salvar o fluxo."), 500, {
        requestId: a.requestId,
      });
    }
  }
  const ids = ((antigos ?? []) as Array<{ id: string }>).map((x) => x.id);
  if (ids.length > 0) {
    await a.supabase
      .from("demand_approach_steps")
      .delete()
      .eq("organization_id", a.orgId)
      .in("id", ids);
  }
  return ok({ passos: novos.length }, { requestId: a.requestId });
}
