/**
 * GET  /api/v1/vendas?contato=<uuid> — as vendas (oportunidades) da empresa (agent+), com cliente,
 *      campanha e funil. A venda É a oportunidade: o id é o do card, o status é derivado das
 *      parcelas e da etapa.
 * POST /api/v1/vendas — registra uma venda de um cliente (agent+): numa oportunidade existente
 *      (`lead_id`) ou numa oportunidade nova. A primeira parcela recebida leva a oportunidade a
 *      Comprou (trigger do banco).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  camposDaOportunidade,
  completarItensComProduto,
  definirResponsavelDaVenda,
  destinoDeUmaOportunidadeNova,
  gravarItensEParcelas,
} from "@/lib/vendas-servidor";
import { SELECAO_DA_OPORTUNIDADE, novaVendaSchema, vendaDaOportunidade } from "@/lib/vendas";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const LIMITE = 3000;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const parametros = new URL(req.url).searchParams;
  const contato = parametros.get("contato");
  const lead = parametros.get("lead");
  // "Pendentes de detalhe" acabou: a oportunidade só vira Comprou com o pagamento registrado.
  if (parametros.get("pendentes") === "1") return ok({ vendas: [] }, { requestId });
  if (contato && !z.string().uuid().safeParse(contato).success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  let q = supabase
    .from("crm_leads")
    .select(SELECAO_DA_OPORTUNIDADE)
    .eq("organization_id", authz.org.orgId)
    .not("contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (contato) q = q.eq("contact_id", contato);
  if (lead && z.string().uuid().safeParse(lead).success) q = q.eq("id", lead);
  const { data, error } = await q;
  if (error) return fail("internal_error", "Erro ao carregar as vendas.", 500, { requestId });
  return ok(
    {
      vendas: ((data ?? []) as unknown as Array<Record<string, unknown>>).map(vendaDaOportunidade),
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const corpo = novaVendaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  // O cliente precisa ser desta empresa: não existe venda sem cliente.
  const { data: contato } = await supabase
    .from("contacts")
    .select("id, name, display_name, phone_number")
    .eq("id", corpo.data.contact_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", "Cliente não encontrado.", 404, { requestId });

  const {
    itens: itensBrutos,
    pagamentos: pagamentosBrutos,
    responsavel_id: responsavel,
    lead_id: leadPedido,
    ...campos
  } = corpo.data;
  const completos = await completarItensComProduto(supabase, orgId, itensBrutos ?? []);
  if (!completos.ok) {
    return fail(
      "validation_failed",
      "Toda venda precisa ser de um produto cadastrado em Produtos e Ofertas.",
      422,
      { requestId },
    );
  }
  const itens = completos.itens;
  const valor =
    itens.length > 0
      ? itens.reduce((s, i) => s + i.amount_cents, 0)
      : (campos.amount_cents ?? 0);
  // Venda concluída sem parcelas: uma parcela única, recebida na data do pagamento.
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const pagamentos =
    pagamentosBrutos && pagamentosBrutos.length > 0
      ? pagamentosBrutos
      : campos.status === "concluida" && valor > 0
        ? [
            {
              number: 1,
              due_on: campos.paid_on ?? hoje,
              paid_on: campos.paid_on ?? hoje,
              amount_cents: valor,
              status: "recebida" as const,
            },
          ]
        : undefined;

  let leadId = leadPedido ?? null;
  if (leadId) {
    const { data: existe } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("id", leadId)
      .eq("organization_id", orgId)
      .eq("contact_id", corpo.data.contact_id)
      .maybeSingle();
    if (!existe) return fail("not_found", "Oportunidade não encontrada.", 404, { requestId });
    const patch: Record<string, unknown> = {
      ...camposDaOportunidade(campos),
      ...(itens.length === 0 && campos.amount_cents !== undefined
        ? { value_cents: campos.amount_cents > 0 ? campos.amount_cents : null }
        : {}),
      ...(pagamentos && pagamentos.length > 0 ? { installments: pagamentos.length } : {}),
    };
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("crm_leads")
        .update(patch)
        .eq("id", leadId)
        .eq("organization_id", orgId);
      if (error) return fail("internal_error", "Erro ao registrar a venda.", 500, { requestId });
    }
  } else {
    const destino = await destinoDeUmaOportunidadeNova(
      supabase,
      orgId,
      corpo.data.contact_id,
      corpo.data.pipeline_id ?? null,
    );
    if (!destino) {
      return fail("validation_failed", "A empresa ainda não tem um funil com etapa inicial.", 422, {
        requestId,
      });
    }
    const c = contato as {
      name: string | null;
      display_name: string | null;
      phone_number: string | null;
    };
    const titulo = (c.display_name?.trim() || c.name?.trim() || c.phone_number || "Venda").slice(0, 200);
    const { data: criada, error } = await supabase
      .from("crm_leads")
      .insert({
        organization_id: orgId,
        contact_id: corpo.data.contact_id,
        ...destino,
        title: titulo,
        status: "open",
        source: "manual",
        position_in_stage: Date.now(),
        created_by_user_id: authz.user.id,
        ...camposDaOportunidade(campos),
        ...(valor > 0 ? { value_cents: valor } : {}),
        ...(pagamentos && pagamentos.length > 0 ? { installments: pagamentos.length } : {}),
      })
      .select("id")
      .single();
    if (error || !criada) {
      return fail("internal_error", "Erro ao registrar a venda.", 500, { requestId });
    }
    leadId = (criada as { id: string }).id;
    void emitLeadActivity(supabase, {
      organizationId: orgId,
      leadId,
      contactId: corpo.data.contact_id,
      type: "lead_created",
      sourceModule: "vendas",
      actor: { type: "user", id: authz.user.id },
      reason: "Nova oportunidade registrada",
      payload: { origem: "venda" },
    });
  }

  const gravou = await gravarItensEParcelas(supabase, orgId, leadId, itens, pagamentos);
  if (!gravou) {
    return fail("internal_error", "Erro ao registrar os itens ou as parcelas da venda.", 500, {
      requestId,
    });
  }
  if (responsavel !== undefined) {
    await definirResponsavelDaVenda(supabase, orgId, leadId, responsavel);
  }
  const { data } = await supabase
    .from("crm_leads")
    .select(SELECAO_DA_OPORTUNIDADE)
    .eq("id", leadId)
    .single();
  return ok(
    { venda: vendaDaOportunidade(data as unknown as Record<string, unknown>) },
    { requestId, status: 201 },
  );
}
