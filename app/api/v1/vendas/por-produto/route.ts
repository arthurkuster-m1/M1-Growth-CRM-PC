/**
 * GET /api/v1/vendas/por-produto?mes=AAAA-MM — quantas vendas e quanto faturamento cada produto
 * do catálogo trouxe no mês (recebido e a receber, rateado pelo peso de cada item). Agent+.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const mesSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const mes = mesSchema.safeParse(req.nextUrl.searchParams.get("mes"));
  if (!mes.success) return fail("validation_failed", "Mês inválido.", 422, { requestId });
  const [a, m] = mes.data.split("-").map(Number) as [number, number];
  const de = `${mes.data}-01`;
  const ate = `${mes.data}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vendas_por_produto", {
    p_org: authz.org.orgId,
    p_from: de,
    p_to: ate,
  });
  if (error)
    return fail("internal_error", "Erro ao carregar as vendas por produto.", 500, { requestId });
  return ok(
    {
      de,
      ate,
      produtos: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        product_id: r.product_id as string,
        nome: String(r.nome ?? ""),
        vendas: Number(r.vendas) || 0,
        interesse: (Number(r.interesse_cents) || 0) / 100,
        recebido: (Number(r.recebido_cents) || 0) / 100,
        a_receber: (Number(r.a_receber_cents) || 0) / 100,
      })),
    },
    { requestId },
  );
}
