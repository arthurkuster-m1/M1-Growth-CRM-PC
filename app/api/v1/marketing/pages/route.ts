import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/marketing/pages?modulo=<chave> — as SUBPÁGINAS de um módulo. A agência vê todas;
 *      o cliente, só as publicadas (rascunho e título de página não liberada não vazam).
 * POST /api/v1/marketing/pages — cria uma subpágina (`{ modulo, tipo, title }`) já com o modelo
 *      do tipo no rascunho. Tipo de página única (pesquisa, árvore…) devolve a que já existe.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { modeloDoModulo } from "@/lib/marketing/modelos";
import { chaveDeSubpagina, lerChaveDePagina, tiposDeSubpagina } from "@/lib/marketing/modulos";
import { novaSubpaginaSchema, type ResumoDeSubpagina } from "@/lib/marketing/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";
const novoId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALFABETO[b % ALFABETO.length]).join(
    "",
  );

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const modulo = req.nextUrl.searchParams.get("modulo") ?? "";
  const lida = lerChaveDePagina(modulo);
  if (!lida || lida.tipo !== null) {
    return fail("not_found", t("Página não encontrada."), 404, { requestId });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_pages")
    .select("module_key, title, published_blocks")
    .eq("organization_id", authz.org.orgId)
    .like("module_key", `${modulo}--%`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error)
    return fail("internal_error", t("Erro ao carregar as subpáginas."), 500, { requestId });

  const podeEditar =
    roleAtLeast(authz.org.role, "manager") || (authz.user.is_platform_admin && !authz.user.support);
  const subpaginas: ResumoDeSubpagina[] = [];
  for (const l of (data ?? []) as Array<{
    module_key: string;
    title: string;
    published_blocks: unknown;
  }>) {
    const chave = lerChaveDePagina(l.module_key);
    if (!chave?.tipo) continue;
    const publicada = l.published_blocks !== null;
    if (!publicada && !podeEditar) continue;
    subpaginas.push({ key: l.module_key, tipo: chave.tipo, title: l.title, publicada });
  }
  return ok({ subpaginas, pode_editar: podeEditar }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
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

  const corpo = novaSubpaginaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { modulo, tipo, title } = corpo.data;
  const definicao = tiposDeSubpagina(modulo).find((x) => x.tipo === tipo)!;
  const chave = chaveDeSubpagina(modulo, tipo, definicao.repetivel ? novoId() : undefined);

  const supabase = await createClient();
  const { data: existente } = await supabase
    .from("marketing_pages")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .eq("module_key", chave)
    .maybeSingle();
  if (existente) return ok({ key: chave, criada: false }, { requestId });

  const { data: pagina, error } = await supabase
    .from("marketing_pages")
    .insert({ organization_id: authz.org.orgId, module_key: chave, title })
    .select("id")
    .single();
  if (error || !pagina) {
    return fail("internal_error", t("Erro ao criar a página."), 500, { requestId });
  }
  const id = (pagina as { id: string }).id;
  const { error: erroDoRascunho } = await supabase.from("marketing_page_drafts").insert({
    page_id: id,
    organization_id: authz.org.orgId,
    blocks: modeloDoModulo(chave, () => randomUUID().slice(0, 12)),
    updated_by: authz.user.id,
  });
  if (erroDoRascunho) {
    await supabase.from("marketing_pages").delete().eq("id", id);
    return fail("internal_error", t("Erro ao criar a página."), 500, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.subpage_created",
    resourceType: "marketing_pages",
    resourceId: id,
    requestId,
    metadata: { module_key: chave },
  });
  return ok({ key: chave, criada: true }, { requestId, status: 201 });
}
