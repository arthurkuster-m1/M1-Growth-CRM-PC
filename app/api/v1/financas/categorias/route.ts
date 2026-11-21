/** POST /api/v1/financas/categorias — cria uma categoria. Piso `manager`; a empresa é a da sessão. */
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_CATEGORIA,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { novaCategoriaSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, novaCategoriaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  if (corpo.dados.group_id) {
    const { data: g } = await supabase
      .from("fin_category_groups")
      .select("id")
      .eq("id", corpo.dados.group_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!g) return fail("validation_failed", "Grupo inválido.", 422, { requestId });
  }
  const { data, error } = await supabase
    .from("fin_categories")
    .insert({ ...corpo.dados, organization_id: orgId })
    .select(COLUNAS_DA_CATEGORIA)
    .single();
  if (error) return respostaDeErroDoBanco(error, requestId, "categorias.criar");
  await audit({
    action: "financas.categoria_criada",
    resourceType: "fin_category",
    resourceId: data.id as string,
    requestId,
    metadata: { tipo: corpo.dados.tipo },
  });
  return ok(data, { requestId, status: 201 });
}
