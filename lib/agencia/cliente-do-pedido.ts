import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import { HEADER_CLIENTE_DA_AGENCIA } from "@/lib/agencia/cliente-da-aba";
import { roleAtLeast, type UserOrgMembership } from "@/lib/auth/types";

/**
 * O cliente da agência que ESTE pedido (página ou API) pede para operar, ou `null`.
 *
 * O id vem num header (`X-Agencia-Cliente`) e NUNCA vale sozinho: só passa se a pessoa já é MEMBRO
 * aceito daquela organização como manager ou admin — exatamente o que ela já poderia escolher no
 * seletor de organizações. Assim o header não concede acesso nenhum; só troca QUAL das suas
 * organizações responde ao pedido (a RLS continua a de quem está logado).
 */
export async function clienteDoPedido(
  memberships: readonly UserOrgMembership[],
): Promise<string | null> {
  let bruto: string | null = null;
  try {
    bruto = (await headers()).get(HEADER_CLIENTE_DA_AGENCIA);
  } catch {
    return null; // fora de uma requisição
  }
  if (!bruto || !z.string().uuid().safeParse(bruto).success) return null;
  const m = memberships.find((o) => o.organization_id === bruto);
  return m && roleAtLeast(m.role, "manager") ? bruto : null;
}
