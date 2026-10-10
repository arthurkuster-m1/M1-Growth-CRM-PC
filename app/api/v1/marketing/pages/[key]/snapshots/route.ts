import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/marketing/pages/[key]/snapshots — o histórico da página (toda a empresa lê).
 * POST /api/v1/marketing/pages/[key]/snapshots — salva um retrato do que está PUBLICADO hoje.
 *
 * O retrato sempre sai do publicado, nunca do rascunho: o cliente lê o histórico e não pode ver
 * o que a agência ainda não liberou. Salvar é manual (a agência decide o que vale registrar).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import {
  COLUNAS_DO_RETRATO,
  MAXIMO_DE_RETRATOS,
  RETRATOS_NA_TELA,
  retratoSchema,
  versoesDasLinhas,
} from "@/lib/marketing/historico";
import { chaveDeModuloSchema } from "@/lib/marketing/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ key: string }>;
}

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const chave = chaveDeModuloSchema.safeParse((await ctx.params).key);
  if (!chave.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_page_snapshots")
    .select(COLUNAS_DO_RETRATO)
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave.data)
    .order("taken_at", { ascending: false })
    .limit(RETRATOS_NA_TELA);
  if (error) return fail("internal_error", t("Erro ao carregar o histórico."), 500, { requestId });

  return ok(
    {
      versoes: versoesDasLinhas(
        (data ?? []) as Array<{ id: string; taken_at: string; note: string; blocks: unknown }>,
      ),
    },
    { requestId },
  );
}

export async function POST(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const chave = chaveDeModuloSchema.safeParse((await ctx.params).key);
  if (!chave.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const corpo = retratoSchema.safeParse(await req.json().catch(() => ({})));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data: pagina } = await supabase
    .from("marketing_pages")
    .select("id, published_blocks")
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave.data)
    .maybeSingle();
  const linha = pagina as { id: string; published_blocks: unknown } | null;
  if (!linha || linha.published_blocks === null) {
    return fail("validation_failed", t("Publique a página antes de salvar um retrato."), 422, {
      requestId,
    });
  }

  const { count } = await supabase
    .from("marketing_page_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("page_id", linha.id);
  if ((count ?? 0) >= MAXIMO_DE_RETRATOS) {
    return fail(
      "validation_failed",
      t("Esta página já tem 60 retratos. Apague os mais antigos para salvar outro."),
      422,
      { requestId },
    );
  }

  const blocos = lerBlocos(linha.published_blocks);
  const { data: criado, error } = await supabase
    .from("marketing_page_snapshots")
    .insert({
      organization_id: authz.org.orgId,
      page_id: linha.id,
      module_key: chave.data,
      note: corpo.data.note,
      blocks: blocos,
      taken_by: authz.user.id,
    })
    .select(COLUNAS_DO_RETRATO)
    .single();
  if (error || !criado) {
    return fail("internal_error", t("Erro ao salvar o retrato."), 500, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.snapshot_created",
    resourceType: "marketing_pages",
    resourceId: linha.id,
    requestId,
    metadata: { module_key: chave.data, blocos: blocos.length },
  });

  return ok(
    {
      versao: versoesDasLinhas([
        criado as { id: string; taken_at: string; note: string; blocks: unknown },
      ])[0],
    },
    { requestId, status: 201 },
  );
}
