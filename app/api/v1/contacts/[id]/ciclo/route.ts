/**
 * GET /api/v1/contacts/[id]/ciclo — o ciclo de vida da pessoa, por que ele é esse, quem cuida do
 * relacionamento e o histórico de estados (pessoa, oportunidades e pagamentos dela).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Contato não encontrado.", 404, { requestId });
  }
  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const { data: c } = await supabase
    .from("contacts")
    .select("id, ciclo_de_vida, ciclo_motivo, ativo_ate, dono_user_id, oportunidades_abertas")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!c) return fail("not_found", "Contato não encontrado.", 404, { requestId });
  const { data: historico } = await supabase
    .from("crm_historico_de_estados")
    .select("id, entidade, entidade_id, de, para, motivo, autor_tipo, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  // A janela de cliente ativo de cada produto que a pessoa já pagou (a do produto, ou a padrão).
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  const bruto = Number((org?.settings as Record<string, unknown> | null)?.janela_ativo_meses);
  const padrao = Number.isFinite(bruto) && bruto >= 1 && bruto <= 60 ? Math.round(bruto) : 6;
  const { data: oportunidades } = await supabase
    .from("crm_leads")
    .select(
      "id, items:crm_sale_items(product_id, product_name), payments:crm_sale_payments(status, paid_on)",
    )
    .eq("organization_id", orgId)
    .eq("contact_id", id)
    .neq("status", "lost")
    .limit(200);
  const ultimoPorProduto = new Map<string, { nome: string; ultimo: string }>();
  for (const o of (oportunidades ?? []) as unknown as Array<{
    items: Array<{ product_id: string; product_name: string }> | null;
    payments: Array<{ status: string; paid_on: string | null }> | null;
  }>) {
    const pagas = (o.payments ?? [])
      .filter((p) => p.status === "recebida" && p.paid_on)
      .map((p) => String(p.paid_on).slice(0, 10))
      .sort();
    const ultimo = pagas[pagas.length - 1];
    if (!ultimo) continue;
    for (const i of o.items ?? []) {
      const atual = ultimoPorProduto.get(i.product_id);
      if (!atual || ultimo > atual.ultimo) {
        ultimoPorProduto.set(i.product_id, { nome: i.product_name, ultimo });
      }
    }
  }
  const idsDosProdutos = [...ultimoPorProduto.keys()];
  const janelas = new Map<string, number | null>();
  if (idsDosProdutos.length > 0) {
    const { data: paginas } = await supabase
      .from("marketing_pages")
      .select("id, janela_ativo_meses")
      .eq("organization_id", orgId)
      .in("id", idsDosProdutos);
    for (const p of (paginas ?? []) as Array<{ id: string; janela_ativo_meses: number | null }>) {
      janelas.set(p.id, p.janela_ativo_meses);
    }
  }
  const produtos = idsDosProdutos.map((pid) => {
    const x = ultimoPorProduto.get(pid)!;
    const meses = janelas.get(pid) ?? padrao;
    const fim = new Date(`${x.ultimo}T12:00:00Z`);
    fim.setUTCMonth(fim.getUTCMonth() + meses);
    return {
      product_id: pid,
      nome: x.nome,
      janela_meses: meses,
      janela_propria: janelas.get(pid) != null,
      ultimo_pagamento: x.ultimo,
      ativo_ate: fim.toISOString().slice(0, 10),
    };
  });
  return ok({ ...c, historico: historico ?? [], produtos }, { requestId });
}
