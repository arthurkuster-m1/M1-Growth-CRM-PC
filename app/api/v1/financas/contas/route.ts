/** POST /api/v1/financas/contas — cria uma conta ou cartão. Piso `manager`; a empresa é a da sessão. */
import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_CONTA,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { novaContaSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, novaContaSchema, requestId);
  if (!corpo.ok) return corpo.response;

  const { data, error } = await supabase
    .from("fin_accounts")
    .insert({ ...corpo.dados, organization_id: orgId })
    .select(COLUNAS_DA_CONTA)
    .single();
  if (error) return respostaDeErroDoBanco(error, requestId, "contas.criar");
  await audit({
    action: "financas.conta_criada",
    resourceType: "fin_account",
    resourceId: data.id as string,
    requestId,
    metadata: { tipo: corpo.dados.tipo },
  });
  return ok(data, { requestId, status: 201 });
}
