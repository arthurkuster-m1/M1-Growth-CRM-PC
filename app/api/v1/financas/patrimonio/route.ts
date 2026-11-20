/** GET /api/v1/financas/patrimonio?ate=AAAA-MM&meses=12 — patrimônio no FIM de cada mês (contas e cartões separados). */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarFinancas, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { mesIso } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const p = new URL(req.url).searchParams;
  const ate = mesIso.safeParse(p.get("ate"));
  const meses = z.coerce
    .number()
    .int()
    .min(1)
    .max(60)
    .safeParse(p.get("meses") ?? 12);
  if (!ate.success || !meses.success)
    return fail("validation_failed", "Consulta inválida.", 422, { requestId });
  const { data, error } = await supabase.rpc("fin_patrimonio_mensal", {
    p_org: orgId,
    p_ate: `${ate.data}-01`,
    p_meses: meses.data,
  });
  if (error) return respostaDeErroDoBanco(error, requestId, "patrimonio");
  return ok(
    ((data ?? []) as Array<{ mes: string; contas_cents: number; cartoes_cents: number }>).map(
      (x) => ({
        mes: String(x.mes).slice(0, 7),
        contas_cents: Number(x.contas_cents),
        cartoes_cents: Number(x.cartoes_cents),
      }),
    ),
    { requestId },
  );
}
