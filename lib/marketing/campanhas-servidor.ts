import "server-only";

import { randomUUID } from "node:crypto";

import { clienteDaRequisicao, ehRecusa } from "@/lib/agencia/cliente-da-requisicao";
import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

/**
 * A porta das rotas das campanhas de demanda: papel mínimo, a empresa da sessão e o cliente de
 * banco com a RLS de quem chama. Ler é de toda a empresa; escrever, de manager+.
 */
export async function autorizarCampanhas(papel: "viewer" | "manager", escrita: boolean) {
  const requestId = randomUUID();
  const authz = await requireRole(papel, {
    requestId,
    resource: "demand_campaigns",
    allowPlatformAdmin: escrita ? true : "leitura",
  });
  if (!authz.ok) return { ok: false as const, response: authz.response };
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  // MODO AGÊNCIA: os dados de outro cliente (reconferido no servidor).
  const outro = await clienteDaRequisicao(authz.user, authz.org.orgId, escrita, t, requestId);
  if (outro && ehRecusa(outro)) return { ok: false as const, response: outro.response };
  if (outro) {
    return {
      ok: true as const,
      requestId,
      orgId: outro.orgId,
      userId: authz.user.id,
      podeEditar: outro.podeEditar,
      t,
      supabase: outro.supabase,
    };
  }
  const supabase = await createClient();
  const ehGestao =
    roleAtLeast(authz.org.role, "manager") || (authz.user.is_platform_admin && !authz.user.support);
  return {
    ok: true as const,
    requestId,
    orgId: authz.org.orgId,
    userId: authz.user.id,
    podeEditar: ehGestao,
    t,
    supabase,
  };
}

export const campanhaNaoEncontrada = (t: (s: string) => string, requestId: string) =>
  fail("not_found", t("Campanha não encontrada."), 404, { requestId });
