/**
 * PATCH /api/v1/vendas/parcelas/[id] — a confirmação da cobrança (agent+).
 *   { acao: "receber", amount_cents?, paid_on? }  — o lead pagou (pode confirmar o valor real);
 *   { acao: "negociar", amount_cents }            — o valor mudou; segue prevista;
 *   { acao: "adiar", due_on }                     — novo vencimento (o lembrete volta a valer);
 *   { acao: "cancelar" }                          — esta parcela não vai acontecer.
 * Receber ou cancelar fecha o aviso da Central.
 */
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
    forma: z.string().trim().max(60).optional(),
  }),
  z.object({
    acao: z.literal("negociar"),
    amount_cents: z.number().int().min(0).max(100_000_000_000),
  }),
  z.object({ acao: z.literal("adiar"), due_on: dia }),
  z.object({ acao: z.literal("cancelar") }),
  z.object({ acao: z.literal("forma"), forma: z.string().trim().max(60) }),
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
          confirmed_by: authz.user.id,
          ...(c.amount_cents !== undefined ? { amount_cents: c.amount_cents } : {}),
          ...(c.forma ? { forma: c.forma } : {}),
        }
      : c.acao === "negociar"
        ? { amount_cents: c.amount_cents }
        : c.acao === "adiar"
          ? { due_on: c.due_on, reminded_before_on: null, reminded_after_on: null }
          : c.acao === "forma"
            ? { forma: c.forma || null }
            : { status: "cancelada" };

  const { data, error } = await supabase
    .from("crm_sale_payments")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id, lead_id")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao atualizar a parcela.", 500, { requestId });
  if (!data) return fail("not_found", "Parcela não encontrada.", 404, { requestId });

  if (c.acao === "receber" || c.acao === "cancelar") {
    // Fecha o aviso da Central deste cliente (a cobrança foi resolvida).
    const leadId = (data as { lead_id: string | null }).lead_id;
    if (leadId) {
      await createAdminClient()
        .from("agent_inbox_items")
        .update({ status: "resolved" })
        .eq("organization_id", orgId)
        .eq("ref_kind", "lead")
        .eq("ref_id", leadId)
        .eq("status", "open")
        .like("title", "Cobrança:%");
    }
  }
  return ok({ id }, { requestId });
}

/**
 * DELETE /api/v1/vendas/parcelas/[id] — exclui uma parcela CANCELADA (o valor dela já voltou a
 * ser interesse; excluir tira de vez). Parcela prevista ou recebida não se exclui: cancele antes.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Parcela não encontrada.", 404, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_sale_payments")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .eq("status", "cancelada")
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao excluir a parcela.", 500, { requestId });
  if (!data) {
    return fail("not_found", "Só uma parcela cancelada pode ser excluída.", 404, { requestId });
  }
  return ok({ id }, { requestId });
}
