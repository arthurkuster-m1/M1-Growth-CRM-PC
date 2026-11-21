/**
 * GET /api/v1/financas/base — o que toda tela de Finanças precisa para abrir: contas, grupos,
 * categorias e a configuração (teto e meta padrão, conta das vendas).
 *
 * Piso `manager` (decisão do Arthur: as finanças da empresa são de gerente para cima). Org da org
 * ativa (cookie validado), NUNCA do query/body. Leitura pelo client de SESSÃO: a RLS das tabelas
 * `fin_*` repete o piso, então quem não é gerente recebe vazio mesmo se a rota fosse burlada.
 *
 * Empresa sem nenhuma conta ganha a SEMENTE (conta principal + categorias de empresa, `fn_fin_semear`,
 * só service_role): idempotente, só cria o que falta. Banco sem a migration 0700 → 503 com a frase
 * que diz o que fazer (a tela não vira "erro ao carregar").
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { mapearCategorias, mapearContas } from "@/lib/financas/mapear";
import type { GrupoCategoria } from "@/lib/financas/tipos";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS_CONTA =
  "id,nome,tipo,ativa,ordem,rendimento_pct,rendimento_base,dia_fechamento,dia_vencimento,conta_pagamento_id";
const COLUNAS_CATEGORIA = "id,nome,group_id,cor,tipo,orcamento_mensal_cents,ativa,ordem,sistema";

/** O banco ainda não tem as tabelas da 0700 (Postgres 42P01 ou o cache do PostgREST sem a tabela). */
const faltaMigration = (e: { code?: string; message?: string } | null) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    /fin_accounts|schema cache|does not exist/i.test(e.message ?? ""));

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "financas" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const supabase = await createClient();

  async function ler() {
    const [contas, grupos, categorias, config, tetos, metas] = await Promise.all([
      supabase
        .from("fin_accounts")
        .select(COLUNAS_CONTA)
        .eq("organization_id", orgId)
        .order("ordem")
        .order("nome"),
      supabase
        .from("fin_category_groups")
        .select("id,nome,ordem,sistema")
        .eq("organization_id", orgId)
        .order("ordem"),
      supabase
        .from("fin_categories")
        .select(COLUNAS_CATEGORIA)
        .eq("organization_id", orgId)
        .order("ordem"),
      supabase
        .from("fin_orcamento_config")
        .select("teto_padrao_cents,meta_padrao_cents,conta_vendas_id")
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase.from("fin_teto_mensal").select("mes,valor_cents").eq("organization_id", orgId),
      supabase.from("fin_meta_mensal").select("mes,valor_cents").eq("organization_id", orgId),
    ]);
    return { contas, grupos, categorias, config, tetos, metas };
  }

  let r = await ler();
  const erro =
    r.contas.error ??
    r.grupos.error ??
    r.categorias.error ??
    r.config.error ??
    r.tetos.error ??
    r.metas.error;
  if (erro) {
    if (faltaMigration(erro)) {
      return fail(
        "financas_sem_migration",
        "O banco ainda não recebeu a atualização das Finanças (migration 0700). Peça para aplicá-la na VPS.",
        503,
        { requestId },
      );
    }
    logger.error("[financas.base] leitura falhou", { orgId, erro: erro.message });
    return fail("internal_error", "Não foi possível carregar as Finanças.", 500, { requestId });
  }

  if ((r.contas.data ?? []).length === 0) {
    const semeado = await createAdminClient().rpc("fn_fin_semear", { p_org: orgId });
    if (semeado.error) {
      logger.error("[financas.base] semente falhou", { orgId, erro: semeado.error.message });
      return fail("internal_error", "Não foi possível preparar as Finanças desta empresa.", 500, {
        requestId,
      });
    }
    r = await ler();
  }

  const grupos: GrupoCategoria[] = (r.grupos.data ?? []).map((g) => ({
    id: g.id as string,
    nome: g.nome as string,
    ordem: Number(g.ordem),
    sistema: g.sistema === true,
  }));

  return ok(
    {
      contas: mapearContas((r.contas.data ?? []) as Parameters<typeof mapearContas>[0]),
      grupos,
      categorias: mapearCategorias(
        (r.categorias.data ?? []) as Parameters<typeof mapearCategorias>[0],
        grupos,
      ),
      config: {
        teto_padrao_cents: Number(r.config.data?.teto_padrao_cents ?? 0),
        meta_padrao_cents: Number(r.config.data?.meta_padrao_cents ?? 0),
        conta_vendas_id: (r.config.data?.conta_vendas_id as string | null) ?? null,
      },
      // teto e meta do mês: o padrão + a exceção de cada mês ("AAAA-MM" → centavos)
      plano: {
        tetoPadrao: Number(r.config.data?.teto_padrao_cents ?? 0),
        tetos: Object.fromEntries(
          (r.tetos.data ?? []).map((x) => [String(x.mes).slice(0, 7), Number(x.valor_cents)]),
        ),
        metaPadrao: Number(r.config.data?.meta_padrao_cents ?? 0),
        metas: Object.fromEntries(
          (r.metas.data ?? []).map((x) => [String(x.mes).slice(0, 7), Number(x.valor_cents)]),
        ),
      },
    },
    { requestId },
  );
}
