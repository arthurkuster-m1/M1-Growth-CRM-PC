/**
 * PUT /api/v1/anotacoes/[id]/estado — marca/desmarca a página como favorita, registra que a
 * pessoa a abriu agora e/ou a fixa no cartão "Notas" do Início. Preferência pessoal: não audita. Qualquer membro que LÊ a página pode
 * favoritá-la (a RLS de `notes_pages` já esconde o que ele não vê).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { idDeNotaSchema } from "@/lib/anotacoes/paginas";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z
  .object({ favorite: z.boolean(), opened: z.literal(true), home: z.literal(true) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: false,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const id = idDeNotaSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  const parsed = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }

  const supabase = await createClient();
  // A página precisa existir e ser legível por quem pede (a RLS decide).
  const { data: pagina } = await supabase
    .from("notes_pages")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .eq("id", id.data)
    .maybeSingle();
  if (!pagina) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const { error } = await supabase.from("notes_user_state").upsert(
    {
      user_id: authz.user.id,
      page_id: id.data,
      organization_id: authz.org.orgId,
      ...(parsed.data.favorite !== undefined ? { favorite: parsed.data.favorite } : {}),
      ...(parsed.data.opened ? { last_opened_at: new Date().toISOString() } : {}),
      ...(parsed.data.home ? { home_selected_at: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id,page_id" },
  );
  if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });
  return ok({ salvo: true }, { requestId });
}
