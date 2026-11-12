/**
 * GET  /api/v1/anotacoes — a árvore de páginas da organização (sem o conteúdo).
 * POST /api/v1/anotacoes — cria uma página (ou subpágina, com `parent_id`).
 *
 * A agência (manager+) vê tudo, lixeira incluída; os demais membros recebem só o que foi marcado
 * como visível ao cliente. Quem esconde o resto é a RLS (migration 0686), não um `if` desta rota.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DO_RESUMO,
  MAXIMO_DE_PAGINAS,
  novaNotaSchema,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** O banco devolve `numeric` como número ou texto, conforme o driver: a tela só quer número. */
function normalizar(linha: ResumoDaNota): ResumoDaNota {
  return { ...linha, position: Number(linha.position) };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes_pages")
    .select(COLUNAS_DO_RESUMO)
    .eq("organization_id", authz.org.orgId)
    .order("position", { ascending: true })
    .limit(MAXIMO_DE_PAGINAS);
  if (error) return fail("internal_error", t("Erro ao carregar as anotações."), 500, { requestId });

  return ok(
    {
      pages: ((data ?? []) as unknown as ResumoDaNota[]).map(normalizar),
      pode_editar: roleAtLeast(authz.org.role, "manager"),
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = novaNotaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const { parent_id, title, position } = parsed.data;

  const supabase = await createClient();

  // A subpágina nasce com a visibilidade da página-mãe; sem mãe, nasce só da agência.
  let herdada = false;
  if (parent_id) {
    const { data: mae } = await supabase
      .from("notes_pages")
      .select("visible_to_client, deleted_at")
      .eq("organization_id", authz.org.orgId)
      .eq("id", parent_id)
      .maybeSingle();
    const linha = mae as { visible_to_client: boolean; deleted_at: string | null } | null;
    if (!linha || linha.deleted_at) {
      return fail("not_found", t("Página não encontrada."), 404, { requestId });
    }
    herdada = linha.visible_to_client;
  }

  let posicao = position;
  if (posicao === undefined) {
    const { data: ultima } = await supabase
      .from("notes_pages")
      .select("position")
      .eq("organization_id", authz.org.orgId)
      .is("deleted_at", null)
      .filter("parent_id", parent_id ? "eq" : "is", parent_id ?? null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    posicao = ultima ? Number((ultima as { position: number }).position) + 1 : 1;
  }

  const { data, error } = await supabase
    .from("notes_pages")
    .insert({
      organization_id: authz.org.orgId,
      parent_id,
      title,
      position: posicao,
      visible_to_client: herdada,
      created_by: authz.user.id,
      updated_by: authz.user.id,
    })
    .select(COLUNAS_DO_RESUMO)
    .single();
  if (error || !data) {
    return fail("internal_error", t("Erro ao criar a página."), 500, { requestId });
  }
  const criada = normalizar(data as unknown as ResumoDaNota);

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "notes_page.created",
    resourceType: "notes_pages",
    resourceId: criada.id,
    requestId,
    metadata: { parent_id },
  });

  return ok({ page: criada }, { requestId, status: 201 });
}
