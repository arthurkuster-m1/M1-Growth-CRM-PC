/** POST /api/v1/marketing/cronograma/metas — nova meta do topo do cronograma (manager+). */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { COLUNAS_DA_META, metaSchema } from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = metaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const { count } = await a.supabase
    .from("marketing_cronograma_metas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", a.orgId);
  if ((count ?? 0) >= 12) {
    return fail("validation_failed", a.t("O cronograma aceita até 12 metas."), 422, {
      requestId: a.requestId,
    });
  }
  const { data, error } = await a.supabase
    .from("marketing_cronograma_metas")
    .insert({ organization_id: a.orgId, ...corpo.data })
    .select(COLUNAS_DA_META)
    .single();
  if (error || !data)
    return fail("internal_error", a.t("Erro ao salvar a meta."), 500, { requestId: a.requestId });
  return ok(
    { meta: { ...data, ordem: Number((data as { ordem: unknown }).ordem) } },
    { requestId: a.requestId, status: 201 },
  );
}
