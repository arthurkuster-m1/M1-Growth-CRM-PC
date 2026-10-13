import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  contaLiberada,
  existeConexaoDeLeitura,
} from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";

/**
 * Esta organização pode usar a conta de anúncio `conta`? Sem conta (vazio), sim. Sem conexão,
 * sim (não há token para mal-usar). Com token da agência (restrito), só se a conta estiver na
 * lista liberada pelo administrador da plataforma.
 */
export async function contaDoMetaPermitida(
  organizationId: string,
  conta: string | null | undefined,
): Promise<boolean> {
  if (!conta) return true;
  const c = await existeConexaoDeLeitura(createAdminClient(), organizationId, "meta_ads");
  if (!c.conectada) return true;
  return contaLiberada(c, conta);
}
