/** POST /api/v1/marketing/cronograma/itens — nova barra do cronograma geral (manager+). */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { COLUNAS_DO_ITEM, itemSchema } from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = itemSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const { data, error } = await a.supabase
    .from("marketing_cronograma_itens")
    .insert({ organization_id: a.orgId, ...corpo.data })
    .select(COLUNAS_DO_ITEM)
    .single();
  if (error || !data)
    return fail("internal_error", a.t("Erro ao salvar o item."), 500, { requestId: a.requestId });
  return ok(
    { item: { ...data, ordem: Number((data as { ordem: unknown }).ordem) } },
    { requestId: a.requestId, status: 201 },
  );
}
