import "server-only";

import { randomUUID } from "node:crypto";

import { clienteDaRequisicao, ehRecusa } from "@/lib/agencia/cliente-da-requisicao";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

/**
 * A porta das rotas do cronograma: papel mínimo, a empresa da sessão e o cliente de banco com a
 * RLS de quem chama. `leitura` deixa o admin da plataforma em modo suporte olhar.
 */
export async function autorizarCronograma(papel: "viewer" | "manager", escrita: boolean) {
  const requestId = randomUUID();
  const authz = await requireRole(papel, {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: escrita ? true : "leitura",
  });
  if (!authz.ok) return { ok: false as const, response: authz.response };
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const podeEditarNaSessao =
    roleAtLeast(authz.org.role, "manager") || (authz.user.is_platform_admin && !authz.user.support);

  // MODO AGÊNCIA: a tela pode pedir o cronograma de OUTRO cliente (reconferido no servidor).
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
  const podeEditar = podeEditarNaSessao;
  return {
    ok: true as const,
    requestId,
    orgId: authz.org.orgId,
    userId: authz.user.id,
    podeEditar,
    t,
    supabase,
  };
}

export const naoEncontrado = (t: (s: string) => string, requestId: string) =>
  fail("not_found", t("Item não encontrado."), 404, { requestId });
