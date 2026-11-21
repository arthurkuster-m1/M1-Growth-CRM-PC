/**
 * PUT /api/v1/financas/config — teto de gastos e meta de ganhos do mês, e a conta que recebe as vendas.
 * Corpo (qualquer combinação): { teto_padrao_cents, meta_padrao_cents, conta_vendas_id, conta_meta_id,
 *   teto_do_mes: { mes, valor_cents|null }, meta_do_mes: { mes, valor_cents|null } }
 * `valor_cents: null` num mês remove a exceção (volta ao padrão). Piso `manager`.
 */
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarFinancas, lerCorpo, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { configSchema } from "@/lib/financas/validacao";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, configSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const c = corpo.dados;
  if (Object.keys(c).length === 0)
    return fail("validation_failed", "Nada para mudar.", 422, { requestId });

  if (c.conta_vendas_id) {
    const { data: conta } = await supabase
      .from("fin_accounts")
      .select("id,tipo")
      .eq("id", c.conta_vendas_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!conta || conta.tipo === "cartao")
      return fail(
        "validation_failed",
        "Escolha uma conta (não um cartão) para receber as vendas.",
        422,
        { requestId },
      );
  }

  if (c.conta_meta_id) {
    const { data: cartao } = await supabase
      .from("fin_accounts")
      .select("id,tipo")
      .eq("id", c.conta_meta_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!cartao || cartao.tipo !== "cartao")
      return fail("validation_failed", "Escolha um cartão para as cobranças da Meta.", 422, {
        requestId,
      });
  }

  const padrao: Record<string, unknown> = {};
  if (c.teto_padrao_cents !== undefined) padrao.teto_padrao_cents = c.teto_padrao_cents;
  if (c.meta_padrao_cents !== undefined) padrao.meta_padrao_cents = c.meta_padrao_cents;
  if (c.conta_vendas_id !== undefined) padrao.conta_vendas_id = c.conta_vendas_id;
  if (c.conta_meta_id !== undefined) padrao.conta_meta_id = c.conta_meta_id;
  if (Object.keys(padrao).length > 0) {
    const { error } = await supabase
      .from("fin_orcamento_config")
      .upsert(
        { organization_id: orgId, ...padrao, updated_at: new Date().toISOString() },
        { onConflict: "organization_id" },
      );
    if (error) return respostaDeErroDoBanco(error, requestId, "config.padrao");
  }
  // Ligou, trocou ou desligou o cartão da Meta: os lançamentos das cobranças já guardadas acompanham
  // (desligar tira as saídas da Meta do caixa; ligar de novo as traz de volta). Org da sessão.
  if (c.conta_meta_id !== undefined) {
    const { error } = await createAdminClient().rpc("fn_fin_importar_cobrancas_meta", {
      p_org: orgId,
    });
    if (error) return respostaDeErroDoBanco(error, requestId, "config.cobrancas_meta");
  }
  for (const [chave, tabela] of [
    ["teto_do_mes", "fin_teto_mensal"],
    ["meta_do_mes", "fin_meta_mensal"],
  ] as const) {
    const m = c[chave];
    if (!m) continue;
    const mes = `${m.mes}-01`;
    const r =
      m.valor_cents === null
        ? await supabase.from(tabela).delete().eq("organization_id", orgId).eq("mes", mes)
        : await supabase
            .from(tabela)
            .upsert(
              { organization_id: orgId, mes, valor_cents: m.valor_cents },
              { onConflict: "organization_id,mes" },
            );
    if (r.error) return respostaDeErroDoBanco(r.error, requestId, `config.${chave}`);
  }
  await audit({
    action: "financas.config_alterada",
    resourceType: "fin_orcamento_config",
    resourceId: orgId,
    requestId,
    metadata: { campos: Object.keys(c) },
  });
  return ok({ saved: true }, { requestId });
}
