/**
 * GET  /api/v1/vendas?contato=<uuid> — as vendas da empresa (agent+), com cliente, campanha e funil.
 * POST /api/v1/vendas — registra uma venda de um cliente (agent+). A origem (funil, campanha,
 *      LP, criativo) é a do ÚLTIMO cadastro do cliente até a data da venda (trigger do banco).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { completarItensComProduto, definirResponsavelDaVenda } from "@/lib/vendas-servidor";
import { COLUNAS_DA_VENDA, novaVendaSchema, vendaDaLinha } from "@/lib/vendas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const LIMITE = 3000;

const SELECAO = `${COLUNAS_DA_VENDA}, contact:contacts(name, display_name, phone_number), campaign:demand_campaigns(name), pipeline:crm_pipelines(name), lead:crm_leads(stage_id, status, owner_user_id, stage:crm_stages!crm_leads_stage_id_fkey(name)), items:crm_sale_items(id, product_id, product_name, quantity, amount_cents, position), payments:crm_sale_payments(id, number, due_on, paid_on, amount_cents, status)`;

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const parametros = new URL(req.url).searchParams;
  const contato = parametros.get("contato");
  const soPendentes = parametros.get("pendentes") === "1";
  if (contato && !z.string().uuid().safeParse(contato).success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  let q = supabase
    .from("crm_sales")
    .select(SELECAO)
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (contato) q = q.eq("contact_id", contato);
  if (soPendentes) q = q.eq("needs_details", true).limit(20);
  const { data, error } = await q;
  if (error) return fail("internal_error", "Erro ao carregar as vendas.", 500, { requestId });
  return ok(
    { vendas: ((data ?? []) as unknown as Array<Record<string, unknown>>).map(vendaDaLinha) },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_sales" });
  if (!authz.ok) return authz.response;
  const corpo = novaVendaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const supabase = await createClient();
  // O cliente precisa ser desta empresa: não existe venda sem cliente.
  const { data: contato } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", corpo.data.contact_id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", "Cliente não encontrado.", 404, { requestId });

  const { itens: itensBrutos, pagamentos, responsavel_id: responsavel, ...campos } = corpo.data;
  const completos = await completarItensComProduto(supabase, authz.org.orgId, itensBrutos ?? []);
  if (!completos.ok) {
    return fail(
      "validation_failed",
      "Toda venda precisa ser de um produto cadastrado em Produtos e Ofertas.",
      422,
      { requestId },
    );
  }
  const itens = completos.itens;
  const { data: criada, error } = await supabase
    .from("crm_sales")
    .insert({
      ...campos,
      ...(itens && itens.length > 0
        ? { amount_cents: itens.reduce((s, i) => s + i.amount_cents, 0) }
        : {}),
      ...(pagamentos && pagamentos.length > 0 ? { installments: pagamentos.length } : {}),
      organization_id: authz.org.orgId,
      created_by: authz.user.id,
    })
    .select("id")
    .single();
  if (error || !criada) {
    return fail("internal_error", "Erro ao registrar a venda.", 500, { requestId });
  }
  const id = (criada as { id: string }).id;
  const orgId = authz.org.orgId;
  const falha = async () => {
    await supabase.from("crm_sales").delete().eq("id", id).eq("organization_id", orgId);
    return fail("internal_error", "Erro ao registrar os itens ou as parcelas da venda.", 500, {
      requestId,
    });
  };
  if (itens && itens.length > 0) {
    const { error: e1 } = await supabase
      .from("crm_sale_items")
      .insert(itens.map((i, k) => ({ ...i, organization_id: orgId, sale_id: id, position: k })));
    if (e1) return falha();
  }
  if (pagamentos && pagamentos.length > 0) {
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
    if (e2) return falha();
  }
  if (responsavel !== undefined) {
    await definirResponsavelDaVenda(supabase, orgId, id, responsavel);
  }
  const { data } = await supabase.from("crm_sales").select(SELECAO).eq("id", id).single();
  return ok(
    { venda: vendaDaLinha(data as unknown as Record<string, unknown>) },
    { requestId, status: 201 },
  );
}
