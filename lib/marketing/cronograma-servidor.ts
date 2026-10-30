import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { clientesDaAgencia } from "@/lib/agencia/acesso";
import { HEADER_CLIENTE_DA_AGENCIA } from "@/lib/agencia/cliente-da-aba";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // MODO AGÊNCIA: a tela pode pedir o cronograma de OUTRO cliente. O id vem num header e NUNCA vale
  // sozinho: é reconferido contra os clientes a que esta pessoa tem direito (membro manager+ ou
  // super-admin pleno). Quem é só membro usa a própria sessão (RLS); o super-admin sem associação
  // usa o cliente admin, e as rotas filtram `organization_id` em toda consulta.
  const pedido = (await headers()).get(HEADER_CLIENTE_DA_AGENCIA);
  if (pedido && pedido !== authz.org.orgId) {
    const negado = () =>
      fail("forbidden", t("Você não tem acesso a este cliente."), 403, { requestId });
    if (!z.string().uuid().safeParse(pedido).success) return { ok: false as const, response: negado() };
    const cliente = (await clientesDaAgencia(authz.user)).find((c) => c.id === pedido);
    if (!cliente) return { ok: false as const, response: negado() };
    const podeEditarLa = cliente.role === "plataforma" || roleAtLeast(cliente.role, "manager");
    if ((escrita && !podeEditarLa) || authz.user.support) {
      return { ok: false as const, response: negado() };
    }
    const membro = cliente.role !== "plataforma";
    return {
      ok: true as const,
      requestId,
      orgId: cliente.id,
      userId: authz.user.id,
      podeEditar: podeEditarLa,
      t,
      supabase: membro ? await createClient() : createAdminClient(),
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
