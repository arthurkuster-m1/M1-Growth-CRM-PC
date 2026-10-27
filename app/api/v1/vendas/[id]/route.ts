/**
 * PATCH/DELETE /api/v1/vendas/[id] — edita ou apaga uma venda (agent+). O id é o da oportunidade
 * (card do funil). Apagar a venda apaga a oportunidade, e só se ainda não recebeu pagamento.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { concluirCompromissosDaVenda } from "@/lib/agenda/concluir-compromissos-da-venda";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { encerraDemanda } from "@/lib/leads/encerramento";
import { createClient } from "@/lib/supabase/server";
import {
  camposDaOportunidade,
  completarItensComProduto,
  definirResponsavelDaVenda,
  gravarItensEParcelas,
} from "@/lib/vendas-servidor";
import { SELECAO_DA_OPORTUNIDADE, edicaoDeVendaSchema, vendaDaOportunidade } from "@/lib/vendas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const corpo = edicaoDeVendaSchema.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !corpo.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const {
    itens: itensBrutos,
    pagamentos,
    responsavel_id: responsavel,
    status,
    ...campos
  } = corpo.data;

  const { data: existe } = await supabase
    .from("crm_leads")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!existe) return fail("not_found", "Venda não encontrada.", 404, { requestId });

  let itens:
    | Array<{ product_id: string; product_name: string; quantity: number; amount_cents: number }>
    | undefined;
  if (itensBrutos !== undefined) {
    const completos = await completarItensComProduto(supabase, orgId, itensBrutos);
    if (!completos.ok) {
      return fail(
        "validation_failed",
        "Toda venda precisa ser de um produto cadastrado em Produtos e Ofertas.",
        422,
        { requestId },
      );
    }
    itens = completos.itens;
  }

  const patch: Record<string, unknown> = {
    ...camposDaOportunidade(campos),
    ...((itens === undefined || itens.length === 0) && campos.amount_cents !== undefined
      ? { value_cents: campos.amount_cents > 0 ? campos.amount_cents : null }
      : {}),
    ...(pagamentos && pagamentos.length > 0 ? { installments: pagamentos.length } : {}),
  };
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from("crm_leads")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) return fail("internal_error", "Erro ao salvar a venda.", 500, { requestId });
  }
  if (responsavel !== undefined) {
    const ok2 = await definirResponsavelDaVenda(supabase, orgId, id, responsavel);
    if (!ok2) return fail("internal_error", "Erro ao salvar o responsável.", 500, { requestId });
  }
  if (itens !== undefined || pagamentos !== undefined) {
    const gravou = await gravarItensEParcelas(supabase, orgId, id, itens, pagamentos);
    if (!gravou) {
      return fail("internal_error", "Erro ao salvar os itens ou as parcelas.", 500, { requestId });
    }
  }

  // O dinheiro mora nas parcelas: "Pago" sem parcela cria a parcela recebida hoje; "Comprometido"
  // sem parcela cria a prevista para hoje; desmarcar o "à vista" recebido volta a parcela a prevista.
  if (status === "concluida" || status === "comprometida") {
    const { data: parc } = await supabase
      .from("crm_sale_payments")
      .select("id, status")
      .eq("lead_id", id)
      .eq("organization_id", orgId)
      .neq("status", "cancelada");
    const vivas = (parc ?? []) as Array<{ id: string; status: string }>;
    const { data: valorRow } = await supabase
      .from("crm_leads")
      .select("value_cents")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle();
    const valor =
      Number((valorRow as { value_cents: number | string | null } | null)?.value_cents) || 0;
    const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    if (vivas.length === 0 && valor > 0) {
      await supabase.from("crm_sale_payments").insert({
        organization_id: orgId,
        lead_id: id,
        number: 1,
        due_on: hoje,
        paid_on: status === "concluida" ? hoje : null,
        amount_cents: valor,
        status: status === "concluida" ? "recebida" : "prevista",
      });
    } else if (vivas.length === 1 && vivas[0]!.status === "recebida" && status === "comprometida") {
      await supabase
        .from("crm_sale_payments")
        .update({ status: "prevista" })
        .eq("id", vivas[0]!.id)
        .eq("organization_id", orgId);
    } else if (vivas.length === 1 && vivas[0]!.status === "prevista" && status === "concluida") {
      await supabase
        .from("crm_sale_payments")
        .update({ status: "recebida", paid_on: hoje })
        .eq("id", vivas[0]!.id)
        .eq("organization_id", orgId);
    }
  }

  // "Recorrência ativa": a venda vira assinatura em andamento (gera as parcelas dos meses à frente).
  if (status === "recorrencia_ativa") {
    await supabase
      .from("crm_leads")
      .update({ is_recurring: true, recurrence_active: true })
      .eq("id", id)
      .eq("organization_id", orgId);
  }
  // "Recorrência encerrada": para de gerar parcelas e as previstas saem; o que já entrou fica.
  if (status === "recorrencia_encerrada") {
    await supabase
      .from("crm_leads")
      .update({ recurrence_active: false })
      .eq("id", id)
      .eq("organization_id", orgId);
    await supabase
      .from("crm_sale_payments")
      .update({ status: "cancelada" })
      .eq("lead_id", id)
      .eq("organization_id", orgId)
      .eq("status", "prevista");
  }

  // "Cancelada": a oportunidade termina como Não comprou e as parcelas abertas saem.
  if (status === "cancelada" && (existe as { status: string }).status !== "lost") {
    await supabase
      .from("crm_sale_payments")
      .update({ status: "cancelada" })
      .eq("lead_id", id)
      .eq("organization_id", orgId)
      .eq("status", "prevista");
    try {
      await encerraDemanda(
        supabase,
        {
          organization_id: orgId,
          actor: { type: "user", id: authz.user.id },
          requestId,
          idioma: authz.user.idioma,
        },
        { leadId: id, desfecho: "lost", motivo: "cancelled_by_customer" },
      );
    } catch {
      return fail("internal_error", "Erro ao cancelar a venda.", 500, { requestId });
    }
  }

  // A venda puxa o compromisso: quem comprou compareceu (ver o helper).
  await concluirCompromissosDaVenda(supabase, orgId, id);

  const { data: venda } = await supabase
    .from("crm_leads")
    .select(SELECAO_DA_OPORTUNIDADE)
    .eq("id", id)
    .single();
  return ok(
    { venda: vendaDaOportunidade(venda as unknown as Record<string, unknown>) },
    { requestId },
  );
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Venda não encontrada.", 404, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const { count: recebidas } = await supabase
    .from("crm_sale_payments")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", id)
    .eq("organization_id", orgId)
    .eq("status", "recebida");
  if ((recebidas ?? 0) > 0) {
    return fail(
      "conflict",
      "Esta venda já recebeu pagamento. Cancele as parcelas recebidas antes de apagar.",
      409,
      { requestId },
    );
  }
  const { error } = await supabase
    .from("crm_leads")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return fail("internal_error", "Erro ao apagar a venda.", 500, { requestId });
  return ok({ apagado: true }, { requestId });
}
