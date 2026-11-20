/**
 * PATCH /api/v1/financas/lancamentos/[id]   muda campos de UM lançamento (pagar = { status: "pago" })
 * DELETE /api/v1/financas/lancamentos/[id]  apaga
 *
 * Piso `manager`; o filtro por `organization_id` é o da SESSÃO. A coerência da linha (transferência
 * sem categoria, conta/categoria da mesma empresa) é conferida pelo banco.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { mudancaDeLancamentoSchema } from "@/lib/financas/validacao";
import {
  COLUNAS_DO_LANCAMENTO,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Lançamento inválido.", 422, { requestId });

  const corpo = await lerCorpo(req, mudancaDeLancamentoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  if (Object.keys(corpo.dados).length === 0)
    return fail("validation_failed", "Nada para mudar.", 422, { requestId });

  const { data, error } = await supabase
    .from("fin_transactions")
    .update(corpo.dados)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select(COLUNAS_DO_LANCAMENTO)
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "lancamentos.mudar");
  if (!data) return fail("not_found", "Lançamento não encontrado.", 404, { requestId });

  await audit({
    action: "financas.lancamento_alterado",
    resourceType: "fin_transaction",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(corpo.dados) },
  });
  return ok(data, { requestId });
}

export async function DELETE(_req: NextRequest, { params }: Contexto): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Lançamento inválido.", 422, { requestId });

  const { data, error } = await supabase
    .from("fin_transactions")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id,valor_cents,tipo,origem")
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "lancamentos.apagar");
  if (!data) return fail("not_found", "Lançamento não encontrado.", 404, { requestId });

  await audit({
    action: "financas.lancamento_removido",
    resourceType: "fin_transaction",
    resourceId: id,
    requestId,
    metadata: { tipo: data.tipo, valor_cents: data.valor_cents, origem: data.origem },
  });
  return ok({ deleted: true }, { requestId });
}
