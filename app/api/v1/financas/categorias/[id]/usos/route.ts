/** GET /api/v1/financas/categorias/[id]/usos — quantos lançamentos usam a categoria (zero = pode apagar). */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarFinancas, respostaDeErroDoBanco } from "@/lib/financas/servidor";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Categoria inválida.", 422, { requestId });
  const { count, error } = await supabase
    .from("fin_transactions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("category_id", id);
  if (error) return respostaDeErroDoBanco(error, requestId, "categorias.usos");
  return ok({ usos: count ?? 0 }, { requestId });
}
