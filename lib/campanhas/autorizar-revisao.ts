import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { carregarCampanha, type CampanhaCarregada } from "@/lib/campanhas/acoes";
import { traduzir } from "@/lib/i18n/dicionario";

/**
 * A porta das rotas da revisão das mensagens da IA: papel de gestão, a campanha da empresa da
 * sessão e o cliente admin (a escrita não passa pelo papel `authenticated`). Escrever só vale com a
 * campanha PREPARADA (`ready`): antes não há lista, depois a mensagem já foi congelada para o envio.
 */
export async function autorizarRevisao(
  admin: SupabaseClient,
  id: string,
  escrita: boolean,
  /** A continuação da conversa age com o disparo já rodando: não exige a campanha preparada. */
  exigePreparada = true,
) {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return { ok: false as const, response: authz.response };
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const carregada = await carregarCampanha(admin, authz.org.orgId, id);
  if (!carregada.ok) {
    return {
      ok: false as const,
      response: fail(carregada.codigo, t(carregada.mensagem), carregada.status, { requestId }),
    };
  }
  const campanha: CampanhaCarregada = carregada.campanha;
  if (escrita && exigePreparada && campanha.status !== "ready") {
    return {
      ok: false as const,
      response: fail(
        "campanha_estado_invalido",
        t("Gere e revise as mensagens com o disparo preparado, antes de iniciar."),
        409,
        { requestId },
      ),
    };
  }
  return {
    ok: true as const,
    requestId,
    t,
    admin,
    campanha,
    orgId: authz.org.orgId,
    userId: authz.user.id,
  };
}
