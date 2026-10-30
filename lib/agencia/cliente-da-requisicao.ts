import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import { clientesDaAgencia } from "@/lib/agencia/acesso";
import { HEADER_CLIENTE_DA_AGENCIA } from "@/lib/agencia/cliente-da-aba";
import { fail } from "@/lib/api/wrappers";
import { roleAtLeast, type AuthUser, type Role } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface ClienteDaRequisicao {
  orgId: string;
  role: Role | "plataforma";
  /** `true` para quem é manager+ no cliente (ou super-admin pleno). */
  podeEditar: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * O MODO AGÊNCIA NO SERVIDOR: a tela pode pedir os dados de OUTRO cliente com o header
 * `X-Agencia-Cliente`. O id NUNCA vale sozinho — é reconferido contra `clientesDaAgencia` (membro
 * manager/admin ou super-admin pleno); fora dela, 403. Quem é membro usa a própria sessão (a RLS
 * continua valendo); o super-admin sem associação usa o cliente admin, e a rota filtra
 * `organization_id` em toda consulta.
 *
 * Devolve `null` quando não há pedido (ou ele é a própria empresa da sessão): a rota segue o caminho
 * normal. Só as famílias de rota listadas em `PREFIXOS_COM_CLIENTE_DA_AGENCIA` carimbam o header.
 */
export async function clienteDaRequisicao(
  user: AuthUser,
  orgDaSessao: string,
  escrita: boolean,
  t: (s: string) => string,
  requestId: string,
): Promise<ClienteDaRequisicao | null | { response: Response }> {
  const pedido = (await headers()).get(HEADER_CLIENTE_DA_AGENCIA);
  if (!pedido || pedido === orgDaSessao) return null;
  const negado = () => ({
    response: fail("forbidden", t("Você não tem acesso a este cliente."), 403, { requestId }),
  });
  if (!z.string().uuid().safeParse(pedido).success || user.support) return negado();
  const cliente = (await clientesDaAgencia(user)).find((c) => c.id === pedido);
  if (!cliente) return negado();
  const podeEditar = cliente.role === "plataforma" || roleAtLeast(cliente.role, "manager");
  if (escrita && !podeEditar) return negado();
  return {
    orgId: cliente.id,
    role: cliente.role,
    podeEditar,
    supabase: cliente.role === "plataforma" ? (createAdminClient() as never) : await createClient(),
  };
}

export const ehRecusa = (r: ClienteDaRequisicao | null | { response: Response }): r is { response: Response } =>
  r !== null && "response" in r;
