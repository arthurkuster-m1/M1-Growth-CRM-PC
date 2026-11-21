/**
 * /api/v1/financas/conferencia-fatura — o total que o BANCO diz para a fatura de um cartão num mês
 * ("bate / diferença de R$ X" compara com o total do app).
 *   GET ?conta=<id>&mes=AAAA-MM            → { id, account_id, mes, total_banco_cents, nota } | null
 *   PUT { conta, mes, total_banco_cents }  → grava; total_banco_cents null remove a conferência do mês
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarFinancas, lerCorpo, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { conferenciaDeFaturaSchema, mesIso } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const p = new URL(req.url).searchParams;
  const conta = z.string().uuid().safeParse(p.get("conta"));
  const mes = mesIso.safeParse(p.get("mes"));
  if (!conta.success || !mes.success)
    return fail("validation_failed", "Consulta inválida.", 422, { requestId });
  const { data, error } = await supabase
    .from("fin_invoice_checks")
    .select("id,account_id,mes,total_banco_cents,nota")
    .eq("organization_id", orgId)
    .eq("account_id", conta.data)
    .eq("mes", `${mes.data}-01`)
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "conferencia_fatura.ler");
  return ok(data ? { ...data, total_banco_cents: Number(data.total_banco_cents) } : null, {
    requestId,
  });
}

export async function PUT(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, conferenciaDeFaturaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const { conta: contaId, mes, total_banco_cents } = corpo.dados;
  const { data: c } = await supabase
    .from("fin_accounts")
    .select("id,tipo")
    .eq("id", contaId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!c || c.tipo !== "cartao")
    return fail("not_found", "Cartão não encontrado.", 404, { requestId });
  const r =
    total_banco_cents === null
      ? await supabase
          .from("fin_invoice_checks")
          .delete()
          .eq("organization_id", orgId)
          .eq("account_id", contaId)
          .eq("mes", `${mes}-01`)
      : await supabase.from("fin_invoice_checks").upsert(
          {
            organization_id: orgId,
            account_id: contaId,
            mes: `${mes}-01`,
            total_banco_cents,
            created_by: userId,
          },
          { onConflict: "account_id,mes" },
        );
  if (r.error) return respostaDeErroDoBanco(r.error, requestId, "conferencia_fatura.gravar");
  await audit({
    action: "financas.fatura_conferida",
    resourceType: "fin_invoice_check",
    resourceId: contaId,
    requestId,
    metadata: { mes, removida: total_banco_cents === null },
  });
  return ok({ saved: true }, { requestId });
}
