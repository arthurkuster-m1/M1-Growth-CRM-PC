/**
 * PUT /api/v1/leads/[id]/proxima-acao — o próximo passo combinado da oportunidade e para quando
 * (`{ proxima_acao, proxima_acao_em }`). Oportunidade aberta sem próximo passo é sinal de perda.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpo = z.object({
  proxima_acao: z.string().trim().max(300).optional(),
  proxima_acao_em: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!z.string().uuid().safeParse(id).success || !parsed.success) {
    return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.proxima_acao !== undefined) patch.proxima_acao = parsed.data.proxima_acao;
  if (parsed.data.proxima_acao_em !== undefined) patch.proxima_acao_em = parsed.data.proxima_acao_em;
  if (Object.keys(patch).length === 0) {
    return fail("validation_failed", "Nada para alterar.", 422, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_leads")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id, proxima_acao, proxima_acao_em")
    .maybeSingle();
  if (error) return fail("internal_error", "Erro ao salvar.", 500, { requestId });
  if (!data) return fail("not_found", "Oportunidade não encontrada.", 404, { requestId });
  return ok(data, { requestId });
}
