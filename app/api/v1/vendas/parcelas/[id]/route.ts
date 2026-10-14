/**
 * PATCH /api/v1/vendas/parcelas/[id] — a confirmação da cobrança (agent+).
 *   { acao: "receber", amount_cents?, paid_on? }  — o lead pagou (pode confirmar o valor real);
 *   { acao: "negociar", amount_cents }            — o valor mudou; segue prevista;
 *   { acao: "adiar", due_on }                     — novo vencimento (o lembrete volta a valer);
 *   { acao: "cancelar" }                          — esta parcela não vai acontecer.
 * Receber ou cancelar fecha o aviso da Central.
 */
import { acertarTotalDaRecorrente } from "@/lib/vendas-servidor";
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const corpoSchema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("receber"),
    amount_cents: z.number().int().min(0).max(100_000_000_000).optional(),
    paid_on: dia.optional(),
  }),
  z.object({
    acao: z.literal("negociar"),
    amount_cents: z.number().int().min(0).max(100_000_000_000),
  }),
  z.object({ acao: z.literal("adiar"), due_on: dia }),
  z.object({ acao: z.literal("cancelar") }),
]);

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !corpo.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const c = corpo.data;

  const patch: Record<string, unknown> =
    c.acao === "receber"
      ? {
          status: "recebida",
          paid_on: c.paid_on ?? new Date().toISOString().slice(0, 10),
          confirmed_at: new Date().toISOString(),
          ...(c.amount_cents !== undefined ? { amount_cents: c.amount_cents } : {}),
        }
      : c.acao === "negociar"
        ? { amount_cents: c.amount_cents }
        : c.acao === "adiar"
          ? { due_on: c.due_on, reminded_before_on: null, reminded_after_on: null }
          : { status: "cancelada" };

  const { data, error } = await supabase
    .from("crm_sale_payments")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id, sale_id")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao atualizar a parcela.", 500, { requestId });
  if (!data) return fail("not_found", "Parcela não encontrada.", 404, { requestId });

  // Assinatura: o total da venda acompanha a soma das parcelas.
  await acertarTotalDaRecorrente(supabase, orgId, data.sale_id as string);

  if (c.acao === "receber" || c.acao === "cancelar") {
    // Fecha o aviso da Central deste cliente (a cobrança foi resolvida).
    const { data: venda } = await supabase
      .from("crm_sales")
      .select("lead_id")
      .eq("id", data.sale_id as string)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (venda?.lead_id) {
      await createAdminClient()
        .from("agent_inbox_items")
        .update({ status: "resolved" })
        .eq("organization_id", orgId)
        .eq("ref_kind", "lead")
        .eq("ref_id", venda.lead_id as string)
        .eq("status", "open")
        .like("title", "Cobrança:%");
    }
  }
  return ok({ id }, { requestId });
}
