/**
 * POST /api/v1/notificacoes/lidas — marca notificações da PRÓPRIA pessoa como lidas: as indicadas
 * (`ids`) ou todas (`todas: true`). Estado pessoal (como favoritar uma anotação): não audita.
 * A sessão só consegue alterar `lida_em` das próprias linhas (grant de coluna + RLS, 0698).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(100) }),
  z.object({ todas: z.literal(true) }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "notificacoes" });
  if (!authz.ok) return authz.response;
  const parsed = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId });

  const supabase = await createClient();
  let consulta = supabase
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", authz.user.id)
    .is("lida_em", null);
  if ("ids" in parsed.data) consulta = consulta.in("id", parsed.data.ids);
  const { error } = await consulta;
  if (error) return fail("internal_error", "Erro ao marcar como lida.", 500, { requestId });
  return ok({ ok: true }, { requestId });
}
