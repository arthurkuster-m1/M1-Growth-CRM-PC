/**
 * PUT    /api/v1/agenda/anti-no-show/[id] — grava o fluxo inteiro e os tipos a que se aplica (manager+).
 * DELETE /api/v1/agenda/anti-no-show/[id] — apaga o fluxo (os tipos voltam à regra de sempre).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fluxoSchema } from "@/lib/agenda/anti-no-show";
import { ligarTiposAoFluxo } from "@/lib/agenda/anti-no-show-servidor";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

type Entrada =
  | { ok: false; erro: Response }
  | { ok: true; requestId: string; orgId: string; t: (s: string) => string };

async function entrar(): Promise<Entrada> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "agenda" });
  if (!authz.ok) return { ok: false, erro: authz.response as Response };
  return {
    ok: true,
    requestId,
    orgId: authz.org.orgId,
    t: (s: string) => traduzir(s, authz.user.idioma),
  };
}

export async function PUT(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const e = await entrar();
  if (!e.ok) return e.erro;
  const { id } = await ctx.params;
  const corpo = fluxoSchema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !corpo.success) {
    return fail("validation_failed", e.t("Dados inválidos."), 422, { requestId: e.requestId });
  }
  const supabase = await createClient();
  const { event_type_ids, ...campos } = corpo.data;
  const { data, error } = await supabase
    .from("agenda_noshow_flows")
    .update(campos)
    .eq("id", id)
    .eq("organization_id", e.orgId)
    .select("id")
    .maybeSingle();
  if (error)
    return fail("internal_error", e.t("Erro ao salvar o fluxo."), 500, { requestId: e.requestId });
  if (!data)
    return fail("not_found", e.t("Fluxo não encontrado."), 404, { requestId: e.requestId });
  if (!(await ligarTiposAoFluxo(supabase, e.orgId, id, event_type_ids))) {
    return fail("internal_error", e.t("Erro ao ligar os tipos."), 500, { requestId: e.requestId });
  }
  return ok({ id }, { requestId: e.requestId });
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const e = await entrar();
  if (!e.ok) return e.erro;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", e.t("Fluxo não encontrado."), 404, { requestId: e.requestId });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_noshow_flows")
    .delete()
    .eq("id", id)
    .eq("organization_id", e.orgId);
  if (error)
    return fail("internal_error", e.t("Erro ao apagar o fluxo."), 500, { requestId: e.requestId });
  return ok({ apagado: true }, { requestId: e.requestId });
}
