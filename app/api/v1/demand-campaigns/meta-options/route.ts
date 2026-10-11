/**
 * GET /api/v1/demand-campaigns/meta-options?account_id=act_<id>
 *
 * O que o gestor escolhe ao atrelar campanhas do Meta a uma campanha de demanda: as contas de
 * anúncio que a conexão alcança e as campanhas da conta escolhida, cada uma dizendo se já está
 * atrelada a alguma campanha do Software (para o filtro "sem associação").
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { lerCredencialDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { lerCampanhas, listarContas } from "@/lib/plataformas-de-anuncio/meta/insights";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { respostaDeFalha, respostaSemConexao } from "../../ads/meta/_falha";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  account_id: z
    .string()
    .regex(/^act_\d+$/)
    .optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "demand_campaigns" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, { requestId });
  }

  const admin = createAdminClient();
  const credencial = await lerCredencialDeLeitura(admin, org.orgId, "meta_ads");
  if (!credencial.ok) return respostaSemConexao(credencial.motivo, { requestId });
  const token = credencial.credencial.accessToken;

  const contas = await listarContas(token);
  if (!contas.ok) return respostaDeFalha(contas.falha, contas.detalhe, { requestId });

  const conta = parsed.data.account_id ?? credencial.credencial.contaPadrao ?? null;
  let campanhas: Array<{ id: string; name: string; status: string | null }> = [];
  if (conta) {
    const lidas = await lerCampanhas(token, conta);
    if (!lidas.ok) return respostaDeFalha(lidas.falha, lidas.detalhe, { requestId });
    campanhas = lidas.dados.flatMap((c) =>
      c.id
        ? [{ id: c.id, name: c.name ?? c.id, status: c.effective_status ?? c.status ?? null }]
        : [],
    );
  }

  // Quem já está atrelado a qual campanha do Software (por id da plataforma).
  const supabase = await createClient();
  const { data: atreladas } = await supabase
    .from("demand_campaigns")
    .select("id, name, platform_campaigns")
    .eq("organization_id", org.orgId);
  const dono = new Map<string, { id: string; name: string }>();
  for (const c of atreladas ?? []) {
    const lista = Array.isArray(c.platform_campaigns) ? c.platform_campaigns : [];
    for (const p of lista as Array<{ id?: string | null }>) {
      if (p?.id) dono.set(p.id, { id: c.id as string, name: c.name as string });
    }
  }

  return ok(
    {
      contas: contas.dados,
      conta_padrao: credencial.credencial.contaPadrao,
      account_id: conta,
      campanhas: campanhas.map((c) => ({ ...c, associada_a: dono.get(c.id) ?? null })),
    },
    { requestId },
  );
}
