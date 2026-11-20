/**
 * /api/v1/financas/abertura — o saldo de ABERTURA de uma conta num mês (editável à mão).
 *   GET ?conta=<id>&mes=AAAA-MM      → { saldo_cents | null }  (null = o mês herda o fechamento do anterior)
 *   GET ?mes=AAAA-MM                  → todas as contas daquele mês: [{ account_id, saldo_cents }]
 *   PUT { conta, mes, saldo_cents }   → grava; saldo_cents null remove (volta a herdar)
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizarFinancas, lerCorpo, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { aberturaSchema, mesIso } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const p = new URL(req.url).searchParams;
  const mes = mesIso.safeParse(p.get("mes"));
  if (!mes.success) return fail("validation_failed", "Mês inválido.", 422, { requestId });
  const conta = p.get("conta");
  let q = supabase
    .from("fin_balance_snapshots")
    .select("account_id,saldo_cents")
    .eq("organization_id", orgId)
    .eq("mes", `${mes.data}-01`);
  if (conta) {
    if (!z.string().uuid().safeParse(conta).success)
      return fail("validation_failed", "Conta inválida.", 422, { requestId });
    q = q.eq("account_id", conta);
  }
  const { data, error } = await q;
  if (error) return respostaDeErroDoBanco(error, requestId, "abertura.ler");
  if (conta)
    return ok({ saldo_cents: data?.[0] ? Number(data[0].saldo_cents) : null }, { requestId });
  return ok(
    (data ?? []).map((l) => ({
      account_id: l.account_id as string,
      saldo_cents: Number(l.saldo_cents),
    })),
    { requestId },
  );
}

export async function PUT(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, aberturaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const { conta, mes, saldo_cents } = corpo.dados;
  const { data: c } = await supabase
    .from("fin_accounts")
    .select("id")
    .eq("id", conta)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!c) return fail("not_found", "Conta não encontrada.", 404, { requestId });
  const r =
    saldo_cents === null
      ? await supabase
          .from("fin_balance_snapshots")
          .delete()
          .eq("organization_id", orgId)
          .eq("account_id", conta)
          .eq("mes", `${mes}-01`)
      : await supabase
          .from("fin_balance_snapshots")
          .upsert(
            { organization_id: orgId, account_id: conta, mes: `${mes}-01`, saldo_cents },
            { onConflict: "account_id,mes" },
          );
  if (r.error) return respostaDeErroDoBanco(r.error, requestId, "abertura.gravar");
  await audit({
    action: "financas.abertura_alterada",
    resourceType: "fin_balance_snapshot",
    resourceId: conta,
    requestId,
    metadata: { mes, removida: saldo_cents === null },
  });
  return ok({ saved: true }, { requestId });
}
