/** PATCH/DELETE /api/v1/marketing/cronograma/itens/[id] — edita ou apaga uma barra (manager+). */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { COLUNAS_DO_ITEM, edicaoDeItemSchema, itemDaLinha } from "@/lib/marketing/cronograma";
import { autorizarCronograma, naoEncontrado } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return naoEncontrado(a.t, a.requestId);
  const corpo = edicaoDeItemSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success || Object.keys(corpo.data).length === 0) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const { data, error } = await a.supabase
    .from("marketing_cronograma_itens")
    .update(corpo.data)
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .select(COLUNAS_DO_ITEM)
    .maybeSingle();
  if (error)
    return fail("internal_error", a.t("Erro ao salvar o item."), 500, { requestId: a.requestId });
  if (!data) return naoEncontrado(a.t, a.requestId);
  return ok(
    { item: itemDaLinha(data as Record<string, unknown>) },
    { requestId: a.requestId },
  );
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return naoEncontrado(a.t, a.requestId);
  const { error } = await a.supabase
    .from("marketing_cronograma_itens")
    .delete()
    .eq("id", id)
    .eq("organization_id", a.orgId);
  if (error)
    return fail("internal_error", a.t("Erro ao apagar o item."), 500, { requestId: a.requestId });
  return ok({ deleted: true }, { requestId: a.requestId });
}
