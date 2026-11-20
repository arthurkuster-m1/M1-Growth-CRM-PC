import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";

import { fail, type ApiError } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

/** Tudo que uma rota das Finanças precisa depois de autorizada. Org e usuário vêm da sessão, nunca do corpo. */
export type ContextoDeFinancas = {
  requestId: string;
  orgId: string;
  userId: string;
  supabase: SupabaseClient;
};

/**
 * Piso `manager` em TODA rota das Finanças (decisão do Arthur: o dinheiro da empresa é de gerente
 * para cima); a RLS das tabelas `fin_*` repete o piso. Rota que escreve passa antes pelo travamento
 * do modo somente leitura do suporte.
 */
export async function autorizarFinancas(
  escrita: boolean,
): Promise<
  { ok: true; ctx: ContextoDeFinancas } | { ok: false; response: NextResponse<ApiError> | Response }
> {
  const requestId = randomUUID();
  if (escrita) {
    const negado = await requireSupportWrite();
    if (negado) return { ok: false, response: negado };
  }
  const authz = await requireRole("manager", { requestId, resource: "financas" });
  if (!authz.ok) return { ok: false, response: authz.response };
  return {
    ok: true,
    ctx: {
      requestId,
      orgId: authz.org.orgId,
      userId: authz.user.id,
      supabase: await createClient(),
    },
  };
}

type ErroDoBanco = { code?: string; message?: string };

/** O banco ainda não tem as tabelas da 0700 (Postgres 42P01 ou o cache do PostgREST sem a tabela). */
export const faltaMigration = (e: ErroDoBanco | null | undefined) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    (e.code !== "23514" && /schema cache|does not exist/i.test(e.message ?? "")));

/** Erro do banco → a resposta que diz O QUE FAZER (e não o texto cru do Postgres). */
export function respostaDeErroDoBanco(
  erro: ErroDoBanco,
  requestId: string,
  contexto: string,
): Response {
  if (faltaMigration(erro)) {
    return fail(
      "financas_sem_migration",
      "O banco ainda não recebeu a atualização das Finanças (migration 0700). Peça para aplicá-la na VPS.",
      503,
      { requestId },
    );
  }
  if (erro.code === "23505")
    return fail(
      "state_conflict",
      "Já existe um item com esse nome (ou esse lançamento já foi registrado).",
      409,
      { requestId },
    );
  if (erro.code === "23503")
    return fail("state_conflict", "Este item está em uso e não pode ser apagado.", 409, {
      requestId,
    });
  if (erro.code === "23514" || erro.code === "22P02" || erro.code === "22007") {
    return fail(
      "validation_failed",
      erro.message?.replace(/^new row.*?violates check constraint /, "Regra violada: ") ??
        "Dados inválidos.",
      422,
      { requestId },
    );
  }
  logger.error(`[financas.${contexto}] erro do banco`, { code: erro.code, message: erro.message });
  return fail("internal_error", "Não foi possível concluir. Tente de novo em instantes.", 500, {
    requestId,
  });
}

/** Lê um corpo JSON e valida; devolve a resposta 422 pronta quando não passa. */
export async function lerCorpo<T>(
  req: Request,
  schema: {
    safeParse: (
      v: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
  requestId: string,
): Promise<{ ok: true; dados: T } | { ok: false; response: Response }> {
  const lido = schema.safeParse(await req.json().catch(() => ({})));
  if (!lido.success) {
    return {
      ok: false,
      response: fail("validation_failed", lido.error.issues[0]?.message ?? "Corpo inválido.", 422, {
        requestId,
      }),
    };
  }
  return { ok: true, dados: lido.data };
}

/** Pagina por `.range()` até acabar: o PostgREST devolve no máximo 1000 linhas por pedido. */
export async function lerTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroDoBanco | null }>,
): Promise<{ data: T[]; error: ErroDoBanco | null }> {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const r = await pagina(de, de + 999);
    if (r.error) return { data: todas, error: r.error };
    const linhas = r.data ?? [];
    todas.push(...linhas);
    if (linhas.length < 1000) return { data: todas, error: null };
  }
}

/** As colunas de um lançamento que o app lê (as mesmas em todas as rotas). */
export const COLUNAS_DO_LANCAMENTO =
  "id,data,valor_cents,tipo,status,nota,category_id,account_id,account_destino_id,fatura_mes,parcela_atual,parcela_total,created_by,created_at,origem,ref_externa";
export const COLUNAS_DA_CONTA =
  "id,nome,tipo,ativa,ordem,rendimento_pct,rendimento_base,dia_fechamento,dia_vencimento,conta_pagamento_id";
export const COLUNAS_DA_CATEGORIA =
  "id,nome,group_id,cor,tipo,orcamento_mensal_cents,ativa,ordem,sistema";
export const COLUNAS_DO_GRUPO = "id,nome,ordem,sistema";
