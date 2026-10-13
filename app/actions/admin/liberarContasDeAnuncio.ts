"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida } from "@/lib/auth/server";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Libera, para UMA organização, as contas de anúncio do Meta que o token dela pode usar.
 *
 * Só o administrador da plataforma (a agência). O token da agência enxerga as contas de todos
 * os clientes; sem esta lista, o gestor de um cliente listaria e leria a conta de outro. Conexão
 * restrita com lista vazia não enxerga conta nenhuma.
 */
export type ResultadoDaLiberacao =
  | { ok: true }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "unauthenticated"
        | "forbidden_role"
        | "mfa_required"
        | "erro_ao_gravar";
    };

const schema = z.object({
  organization_id: z.string().uuid(),
  restringir: z.boolean(),
  contas: z.array(z.string().regex(/^act_\d{1,30}$/)).max(200),
});

export async function liberarContasDeAnuncio(
  input: z.infer<typeof schema>,
): Promise<ResultadoDaLiberacao> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (!authUser.is_platform_admin || supportWriteError(authUser.support)) {
    return { ok: false, error: "forbidden_role" };
  }
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ad_insights_connections")
    .update({
      restrict_accounts: parsed.data.restringir,
      allowed_account_ids: [...new Set(parsed.data.contas)],
      updated_by: authUser.id,
    })
    .eq("organization_id", parsed.data.organization_id)
    .eq("platform", "meta_ads")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "erro_ao_gravar" };

  const hdrs = await headers();
  await audit({
    action: "ad_insights_connection.accounts_changed",
    actorUserId: authUser.id,
    organizationId: parsed.data.organization_id,
    resourceType: "ad_insights_connections",
    resourceId: null,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: { restringir: parsed.data.restringir, contas: parsed.data.contas },
  });
  revalidatePath(`/admin/tenants/${parsed.data.organization_id}/meta-ads`);
  return { ok: true };
}
