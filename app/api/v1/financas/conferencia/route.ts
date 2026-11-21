/**
 * POST /api/v1/financas/conferencia — "bate com o banco?": a pessoa informa o saldo real da conta e a
 * diferença para o saldo calculado vira rendimento, ajuste ou só um registro.
 *
 * A diferença (real − sistema), quando existe e não é "ignorar", vira UM lançamento pago na data
 * informada, na categoria do sistema ("Rendimentos" se for rendimento positivo; senão "Ajuste de
 * saldo", entrada ou saída). Se o registro da conferência falhar depois do lançamento, o lançamento é
 * desfeito: ou entram os dois ou nenhum. Piso `manager`; empresa da sessão.
 */
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarFinancas, lerCorpo, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { conferenciaSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, conferenciaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const c = corpo.dados;
  const contaId = c.conta;

  const { data: conta } = await supabase
    .from("fin_accounts")
    .select("id")
    .eq("id", c.conta)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!conta) return fail("not_found", "Conta não encontrada.", 404, { requestId });

  const dif = c.saldo_real_cents - c.saldo_sistema_cents;
  let lancamentoId: string | null = null;
  if (dif !== 0 && c.destino !== "ignorar") {
    const tipo = dif > 0 ? "entrada" : "saida";
    const rendimento = c.destino === "rendimento" && dif > 0;
    const nomeDaCategoria = rendimento ? "Rendimentos" : "Ajuste de saldo";
    const { data: cat } = await supabase
      .from("fin_categories")
      .select("id")
      .eq("organization_id", orgId)
      .eq("tipo", tipo)
      .eq("nome", nomeDaCategoria)
      .maybeSingle();
    if (!cat) {
      return fail(
        "validation_failed",
        `A categoria "${nomeDaCategoria}" não existe nesta empresa.`,
        422,
        { requestId },
      );
    }
    const { data: tx, error } = await supabase
      .from("fin_transactions")
      .insert({
        organization_id: orgId,
        data: c.data,
        valor_cents: Math.abs(dif),
        tipo,
        status: "pago",
        category_id: cat.id,
        account_id: c.conta,
        nota: c.nota || "Conferência de saldo",
        origem: "manual",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return respostaDeErroDoBanco(error, requestId, "conferencia.lancar");
    lancamentoId = tx.id as string;
  }

  const { error: erroRegistro } = await supabase.from("fin_reconciliations").insert({
    organization_id: orgId,
    account_id: c.conta,
    data: c.data,
    saldo_sistema_cents: c.saldo_sistema_cents,
    saldo_real_cents: c.saldo_real_cents,
    destino: c.destino,
    transaction_id: lancamentoId,
    nota: c.nota ?? null,
    created_by: userId,
  });
  if (erroRegistro) {
    if (lancamentoId)
      await supabase
        .from("fin_transactions")
        .delete()
        .eq("id", lancamentoId)
        .eq("organization_id", orgId);
    return respostaDeErroDoBanco(erroRegistro, requestId, "conferencia.registrar");
  }

  await audit({
    action: "financas.saldo_conferido",
    resourceType: "fin_account",
    resourceId: contaId,
    requestId,
    metadata: { destino: c.destino, diferenca_cents: dif },
  });
  return ok({ diferenca_cents: dif, lancamento_id: lancamentoId }, { requestId, status: 201 });
}
