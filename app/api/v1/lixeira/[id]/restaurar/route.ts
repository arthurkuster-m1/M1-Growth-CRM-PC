/**
 * POST /api/v1/lixeira/[id]/restaurar — devolve o cliente excluído e tudo que saiu com ele
 * (oportunidades, vendas, parcelas, conversas, compromissos…), como estavam. Agent+.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Item não encontrado.", 404, { requestId });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_restaurar_cliente_da_lixeira", {
    p_item: id,
    p_organization_id: authz.org.orgId,
  });
  if (error) {
    const duplicado = error.code === "23505";
    return fail(
      duplicado ? "conflict" : "internal_error",
      duplicado
        ? "Já existe outro contato com o mesmo telefone ou e-mail. Ajuste ou apague o outro e restaure de novo."
        : "Não foi possível restaurar.",
      duplicado ? 409 : 500,
      { requestId },
    );
  }
  if (!data) return fail("not_found", "Item não encontrado.", 404, { requestId });
  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "contact.restored",
    resourceType: "contact",
    resourceId: data as string,
    requestId,
  });
  return ok({ contact_id: data }, { requestId });
}
