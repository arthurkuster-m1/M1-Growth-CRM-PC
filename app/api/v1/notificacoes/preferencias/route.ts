/**
 * GET /api/v1/notificacoes/preferencias — as escolhas da PRÓPRIA pessoa (sem linha = ligado).
 * PUT — liga/desliga uma categoria na tela ou no celular. Vale em todo aparelho, e o servidor
 * deixa de mandar push da categoria desligada (`entregar-notificacao.ts`). Migration 0698.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { NOTIFY_UI_CATEGORIES } from "@/lib/notifications/prefs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  categoria: z.enum(NOTIFY_UI_CATEGORIES),
  canal: z.enum(["na_tela", "no_celular"]),
  ligado: z.boolean(),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notificacoes_preferencias",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notificacoes_preferencias")
    .select("categoria, na_tela, no_celular")
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", authz.user.id);
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01")
      return ok({ prefs: [] }, { requestId });
    return fail("internal_error", "Erro ao carregar as preferências.", 500, { requestId });
  }
  return ok({ prefs: data ?? [] }, { requestId });
}

export async function PUT(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "notificacoes_preferencias" });
  if (!authz.ok) return authz.response;
  const parsed = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  const { categoria, canal, ligado } = parsed.data;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("notificacoes_preferencias")
    .select("na_tela, no_celular")
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", authz.user.id)
    .eq("categoria", categoria)
    .maybeSingle();
  const antes = (atual as { na_tela: boolean; no_celular: boolean } | null) ?? {
    na_tela: true,
    no_celular: true,
  };
  const { error } = await supabase.from("notificacoes_preferencias").upsert(
    {
      user_id: authz.user.id,
      organization_id: authz.org.orgId,
      categoria,
      ...antes,
      [canal]: ligado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,organization_id,categoria" },
  );
  if (error) return fail("internal_error", "Erro ao salvar a preferência.", 500, { requestId });

  void audit({
    action: "notification_prefs.changed",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "notificacoes_preferencias",
    requestId,
    metadata: { categoria, canal, ligado },
  });
  return ok({ ok: true }, { requestId });
}
