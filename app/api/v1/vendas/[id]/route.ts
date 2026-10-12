/** PATCH/DELETE /api/v1/vendas/[id] — edita ou apaga uma venda (agent+). */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_DA_VENDA, edicaoDeVendaSchema, vendaDaLinha } from "@/lib/vendas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const corpo = edicaoDeVendaSchema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !corpo.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  const { itens, pagamentos, ...campos } = corpo.data;
  const orgId = authz.org.orgId;
  const detalhou = itens !== undefined || pagamentos !== undefined;
  const { data, error } = await supabase
    .from("crm_sales")
    .update({
      ...campos,
      ...(itens && itens.length > 0
        ? { amount_cents: itens.reduce((s, i) => s + i.amount_cents, 0) }
        : {}),
      ...(pagamentos && pagamentos.length > 0 ? { installments: pagamentos.length } : {}),
      ...(detalhou && campos.needs_details === undefined ? { needs_details: false } : {}),
    })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao salvar a venda.", 500, { requestId });
  if (!data) return fail("not_found", "Venda não encontrada.", 404, { requestId });

  // Itens e parcelas SUBSTITUEM os anteriores (a venda é o que a tela mandou).
  if (itens !== undefined) {
    await supabase.from("crm_sale_items").delete().eq("sale_id", id).eq("organization_id", orgId);
    if (itens.length > 0) {
      const { error: e1 } = await supabase
        .from("crm_sale_items")
        .insert(itens.map((i, k) => ({ ...i, organization_id: orgId, sale_id: id, position: k })));
      if (e1) return fail("internal_error", "Erro ao salvar os itens.", 500, { requestId });
    }
  }
  if (pagamentos !== undefined) {
    await supabase
      .from("crm_sale_payments")
      .delete()
      .eq("sale_id", id)
      .eq("organization_id", orgId);
    if (pagamentos.length > 0) {
      const { error: e2 } = await supabase.from("crm_sale_payments").insert(
        pagamentos.map((p) => ({
          number: p.number,
          due_on: p.due_on,
          paid_on: p.paid_on ?? null,
          amount_cents: p.amount_cents,
          status: p.status,
          organization_id: orgId,
          sale_id: id,
        })),
      );
      if (e2) return fail("internal_error", "Erro ao salvar as parcelas.", 500, { requestId });
    }
  }
  const { data: venda } = await supabase
    .from("crm_sales")
    .select(
      `${COLUNAS_DA_VENDA}, items:crm_sale_items(id, product_name, quantity, amount_cents, position), payments:crm_sale_payments(id, number, due_on, paid_on, amount_cents, status)`,
    )
    .eq("id", id)
    .single();
  return ok({ venda: vendaDaLinha(venda as unknown as Record<string, unknown>) }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Venda não encontrada.", 404, { requestId });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_sales")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", "Erro ao apagar a venda.", 500, { requestId });
  return ok({ apagado: true }, { requestId });
}
