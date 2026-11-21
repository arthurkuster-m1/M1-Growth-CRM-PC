/**
 * GET /api/v1/financas/saldos                       saldo ATUAL de cada conta (abertura + movimentos pagos até hoje)
 * GET /api/v1/financas/saldos?no_inicio=AAAA-MM[&previstos=1]   saldo de cada conta no INÍCIO do mês
 */
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarFinancas, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { mesIso } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const p = new URL(req.url).searchParams;
  const inicio = p.get("no_inicio");

  if (inicio) {
    const mes = mesIso.safeParse(inicio);
    if (!mes.success) return fail("validation_failed", "Mês inválido.", 422, { requestId });
    const { data, error } = await supabase.rpc("fin_saldos_na_data", {
      p_org: orgId,
      p_data: `${mes.data}-01`,
      p_previstos: p.get("previstos") === "1",
    });
    if (error) return respostaDeErroDoBanco(error, requestId, "saldos.no_inicio");
    return ok(
      Object.fromEntries(
        ((data ?? []) as Array<{ account_id: string; saldo_cents: number }>).map((x) => [
          x.account_id,
          Number(x.saldo_cents),
        ]),
      ),
      { requestId },
    );
  }

  const { data, error } = await supabase
    .from("fin_account_balances")
    .select("account_id,saldo_atual_cents,base_mes,base_cents")
    .eq("organization_id", orgId);
  if (error) return respostaDeErroDoBanco(error, requestId, "saldos.atual");
  return ok(
    (data ?? []).map((s) => ({
      account_id: s.account_id as string,
      saldo_atual_cents: Number(s.saldo_atual_cents),
      base_mes: (s.base_mes as string | null) ?? null,
      base_cents: Number(s.base_cents),
    })),
    { requestId },
  );
}
