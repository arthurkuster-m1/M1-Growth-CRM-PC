/** PATCH /api/v1/financas/contas/[id] — muda uma conta ou cartão (inclui inativar). Piso `manager`. */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_CONTA,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { mudancaDeContaSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Conta inválida.", 422, { requestId });
  const corpo = await lerCorpo(req, mudancaDeContaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  if (Object.keys(corpo.dados).length === 0)
    return fail("validation_failed", "Nada para mudar.", 422, { requestId });
  // a conta que paga o cartão tem de ser desta empresa
  if (corpo.dados.conta_pagamento_id) {
    const { data: paga } = await supabase
      .from("fin_accounts")
      .select("id")
      .eq("id", corpo.dados.conta_pagamento_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!paga) return fail("validation_failed", "Conta de pagamento inválida.", 422, { requestId });
  }

  const { data, error } = await supabase
    .from("fin_accounts")
    .update(corpo.dados)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select(COLUNAS_DA_CONTA)
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "contas.mudar");
  if (!data) return fail("not_found", "Conta não encontrada.", 404, { requestId });
  await audit({
    action: "financas.conta_alterada",
    resourceType: "fin_account",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(corpo.dados) },
  });
  return ok(data, { requestId });
}
