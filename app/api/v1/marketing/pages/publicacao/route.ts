import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/marketing/pages/publicacao — publica ou tira do ar VÁRIAS páginas de uma vez
 * (`{ keys, acao }`). Publicar leva o rascunho de cada uma para o cliente; páginas sem
 * rascunho são ignoradas e contadas. Só a agência (manager+).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerBlocos } from "@/lib/marketing/blocos";
import { publicacaoEmMassaSchema } from "@/lib/marketing/paginas";
import { sincronizarOfertas } from "@/lib/marketing/sincronizar-ofertas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const corpo = publicacaoEmMassaSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const keys = [...new Set(corpo.data.keys)];
  const orgId = authz.org.orgId;

  const supabase = await createClient();
  const { data: paginas, error } = await supabase
    .from("marketing_pages")
    .select("id, module_key")
    .eq("organization_id", orgId)
    .in("module_key", keys);
  if (error) return fail("internal_error", t("Erro ao publicar as páginas."), 500, { requestId });
  const linhas = (paginas ?? []) as Array<{ id: string; module_key: string }>;

  let feitas = 0;
  let ignoradas = keys.length - linhas.length;
  const agora = new Date().toISOString();

  if (corpo.data.acao === "despublicar") {
    for (const l of linhas) {
      const { error: e } = await supabase
        .from("marketing_pages")
        .update({ published_blocks: null, published_at: null, published_by: null })
        .eq("id", l.id)
        .eq("organization_id", orgId);
      if (e) ignoradas += 1;
      else feitas += 1;
    }
  } else {
    const { data: rascunhos } = await supabase
      .from("marketing_page_drafts")
      .select("page_id, blocks")
      .in(
        "page_id",
        linhas.map((l) => l.id),
      );
    const porPagina = new Map(
      ((rascunhos ?? []) as Array<{ page_id: string; blocks: unknown }>).map((r) => [
        r.page_id,
        lerBlocos(r.blocks),
      ]),
    );
    for (const l of linhas) {
      const blocos = porPagina.get(l.id) ?? [];
      if (blocos.length === 0) {
        ignoradas += 1;
        continue;
      }
      const { error: e } = await supabase
        .from("marketing_pages")
        .update({ published_blocks: blocos, published_at: agora, published_by: authz.user.id })
        .eq("id", l.id)
        .eq("organization_id", orgId);
      if (e) ignoradas += 1;
      else feitas += 1;
    }
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action:
      corpo.data.acao === "publicar"
        ? "marketing_page.bulk_published"
        : "marketing_page.bulk_unpublished",
    resourceType: "marketing_pages",
    resourceId: null,
    requestId,
    metadata: { solicitadas: keys.length, feitas, ignoradas, paginas: keys.slice(0, 50) },
  });

  await sincronizarOfertas(orgId);

  return ok({ feitas, ignoradas }, { requestId });
}
