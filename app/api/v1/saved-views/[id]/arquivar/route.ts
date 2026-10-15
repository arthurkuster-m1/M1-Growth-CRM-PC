/**
 * POST /api/v1/saved-views/[id]/arquivar — `{ arquivar: boolean }`: arquiva (ou desarquiva) a
 * visualização SÓ PARA QUEM PEDIU. A visualização em si não muda para ninguém. Serve sobretudo
 * para esconder a visualização de outra pessoa, que não se edita nem se apaga.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z.object({ arquivar: z.boolean() });

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const authz = await requireRole("viewer", { requestId, resource: "crm_saved_views" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }
  const supabase = await createClient();
  const { data: visao } = await supabase
    .from("crm_saved_views")
    .select("id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!visao) return fail("not_found", t("Visualização não encontrada."), 404, { requestId });

  if (parsed.data.arquivar) {
    const { error } = await supabase.from("crm_saved_view_arquivadas").upsert({
      user_id: authz.user.id,
      view_id: id,
      organization_id: authz.org.orgId,
    });
    if (error) return fail("internal_error", t("Erro ao arquivar."), 500, { requestId });
  } else {
    const { error } = await supabase
      .from("crm_saved_view_arquivadas")
      .delete()
      .eq("user_id", authz.user.id)
      .eq("view_id", id);
    if (error) return fail("internal_error", t("Erro ao desarquivar."), 500, { requestId });
  }
  return ok({ arquivada: parsed.data.arquivar }, { requestId });
}
