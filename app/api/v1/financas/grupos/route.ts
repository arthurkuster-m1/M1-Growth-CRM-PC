/** POST /api/v1/financas/grupos — cria um grupo de categorias. Piso `manager`; a empresa é a da sessão. */
import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DO_GRUPO,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { novoGrupoSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, novoGrupoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const { data, error } = await supabase
    .from("fin_category_groups")
    .insert({ ...corpo.dados, organization_id: orgId })
    .select(COLUNAS_DO_GRUPO)
    .single();
  if (error) return respostaDeErroDoBanco(error, requestId, "grupos.criar");
  await audit({
    action: "financas.grupo_criado",
    resourceType: "fin_category_group",
    resourceId: data.id as string,
    requestId,
  });
  return ok(data, { requestId, status: 201 });
}
