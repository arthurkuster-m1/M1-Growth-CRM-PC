import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET /api/v1/view-preferences/[key] — como ESTA pessoa vê a tabela `key`.
 * PUT /api/v1/view-preferences/[key] — grava (substitui) essa preferência.
 *
 * Ordem, largura e visibilidade das colunas das tabelas estilo Notion — por pessoa, por
 * organização e por tela (migration 0583). Qualquer papel lê e grava a PRÓPRIA: é
 * apresentação, não dado da operação, e a policy do banco só deixa cada um tocar a sua.
 *
 * O `user_id` e a organização vêm SEMPRE da sessão (`authz`), nunca do corpo — o corpo só
 * traz a forma do layout, e essa forma é validada por `preferenciasDaTabelaSchema`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { preferenciasDaTabelaSchema, type PreferenciasDaTabela } from "@/lib/motor/layout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Só slug: a chave vira parte de uma consulta e de um índice, e não tem por que ter mais. */
const chaveSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

interface Contexto {
  params: Promise<{ key: string }>;
}

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const chave = chaveSchema.safeParse((await ctx.params).key);

  const authz = await requireRole("viewer", { requestId, resource: "user_view_preferences" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  if (!chave.success) {
    return fail("validation_failed", t("Parâmetros inválidos."), 422, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_view_preferences")
    .select("config")
    .eq("user_id", authz.user.id)
    .eq("organization_id", authz.org.orgId)
    .eq("view_key", chave.data)
    .maybeSingle();

  if (error) {
    return fail("internal_error", t("Erro ao carregar a preferência."), 500, { requestId });
  }

  // Preferência que não passa mais na validação (a forma mudou) vira "sem preferência":
  // o padrão da tela é sempre um estado seguro, e uma linha velha não pode derrubar a tela.
  const lida = preferenciasDaTabelaSchema.safeParse(
    (data as { config?: unknown } | null)?.config ?? {},
  );
  const config: PreferenciasDaTabela = lida.success ? lida.data : {};
  return ok({ config }, { requestId });
}

export async function PUT(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const chave = chaveSchema.safeParse((await ctx.params).key);

  const authz = await requireRole("viewer", { requestId, resource: "user_view_preferences" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const corpo = (await req.json().catch(() => null)) as { config?: unknown } | null;
  const parsed = preferenciasDaTabelaSchema.safeParse(corpo?.config);
  if (!chave.success || !parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<string, unknown>),
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_view_preferences").upsert(
    {
      user_id: authz.user.id,
      organization_id: authz.org.orgId,
      view_key: chave.data,
      config: parsed.data,
    },
    { onConflict: "user_id,organization_id,view_key" },
  );

  if (error) {
    return fail("internal_error", t("Erro ao salvar a preferência."), 500, { requestId });
  }

  return ok({ config: parsed.data }, { requestId });
}
