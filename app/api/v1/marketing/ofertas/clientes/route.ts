/**
 * GET /api/v1/marketing/ofertas/clientes — os clientes para onde se pode COPIAR produtos: os que
 * a pessoa gerencia (manager+ ou super-admin pleno), menos a própria empresa da sessão.
 */
import { randomUUID } from "node:crypto";

import { clientesDaAgencia } from "@/lib/agencia/acesso";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  if (authz.user.support) {
    return fail("forbidden", "Indisponível no modo suporte.", 403, { requestId });
  }
  const clientes = (await clientesDaAgencia(authz.user))
    .filter((c) => c.id !== authz.org.orgId)
    .map((c) => ({ id: c.id, name: c.name, cor: c.cor }));
  return ok({ clientes }, { requestId });
}
