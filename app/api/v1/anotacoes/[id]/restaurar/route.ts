/**
 * POST /api/v1/anotacoes/[id]/restaurar — tira a página da lixeira, com as subpáginas que foram
 * junto com ela (as que têm o mesmo instante de exclusão). Se a página-mãe continua na lixeira ou
 * foi apagada de vez, a página volta para a raiz.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DO_RESUMO,
  idDeNotaSchema,
  idsDaSubarvore,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const id = idDeNotaSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  const notaId = id.data;
  const orgId = authz.org.orgId;

  const supabase = await createClient();
  const { data } = await supabase
    .from("notes_pages")
    .select(COLUNAS_DO_RESUMO)
    .eq("organization_id", orgId)
    .limit(2000);
  const arvore = (data ?? []) as unknown as ResumoDaNota[];
  const atual = arvore.find((n) => n.id === id.data);
  if (!atual) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  if (!atual.deleted_at) return ok({ restaurada: true }, { requestId });

  const alcance = idsDaSubarvore(arvore, id.data).filter(
    (x) => arvore.find((n) => n.id === x)?.deleted_at === atual.deleted_at,
  );
  const mae = atual.parent_id ? arvore.find((n) => n.id === atual.parent_id) : undefined;
  const maeViva = mae !== undefined && !mae.deleted_at;

  const { error } = await supabase
    .from("notes_pages")
    .update({ deleted_at: null, updated_by: authz.user.id })
    .eq("organization_id", orgId)
    .in("id", alcance);
  if (error) return fail("internal_error", t("Erro ao restaurar a página."), 500, { requestId });

  if (atual.parent_id && !maeViva) {
    await supabase
      .from("notes_pages")
      .update({ parent_id: null })
      .eq("organization_id", orgId)
      .eq("id", id.data);
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "notes_page.restored",
    resourceType: "notes_pages",
    resourceId: notaId,
    requestId,
    metadata: { paginas: alcance.length },
  });
  return ok({ restaurada: true }, { requestId });
}
