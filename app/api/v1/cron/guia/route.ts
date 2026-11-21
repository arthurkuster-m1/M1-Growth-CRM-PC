/**
 * GET/POST /api/v1/cron/guia — todo dia, para cada empresa que já tem perfil no Guia: gera as ideias
 * novas a partir dos números das campanhas e mede de novo as aceitas que chegaram na data.
 *
 * Service role, mas cada empresa é processada isoladamente (leituras e escritas filtram
 * `organization_id`) e uma falha numa não derruba as outras. Empresa suspensa é pulada. Só gera
 * SUGESTÃO: nada é enviado a ninguém e nenhuma ideia é aceita sozinha.
 */
import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { gerarEMedirIdeias } from "@/lib/guia/gerar-ideias";
import { logger } from "@/lib/logger";
import { idsDeOrgsParadas } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function executar(req: NextRequest) {
  if (!autorizaCron(req)) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "cron secret inválido" } },
      { status: 401 },
    );
  }
  const admin = createAdminClient();
  const paradas = new Set(await idsDeOrgsParadas(admin));
  const { data, error } = await admin.from("guia_perfil").select("organization_id").limit(2000);
  if (error) {
    // Banco sem a migration do Guia: o cron não tem o que fazer, e isso não é um erro do servidor.
    logger.warn("[cron.guia] sem perfis para ler", { erro: error.message });
    return NextResponse.json({ data: { empresas: 0, criadas: 0, medidas: 0, falhas: 0 } });
  }
  let criadas = 0;
  let medidas = 0;
  let falhas = 0;
  const orgs = ((data ?? []) as { organization_id: string }[])
    .map((r) => r.organization_id)
    .filter((o) => !paradas.has(o));
  for (const orgId of orgs) {
    try {
      const r = await gerarEMedirIdeias(admin, orgId);
      criadas += r.criadas;
      medidas += r.medidas;
      // Rastro só quando a rodada FEZ algo (rodada vazia, a maioria, não grava nada).
      if (r.criadas + r.medidas > 0) {
        await audit({
          organizationId: orgId,
          action: "guia.ideias_geradas",
          resourceType: "guia_ideias",
          resourceId: orgId,
          metadata: { criadas: r.criadas, medidas: r.medidas, origem: "cron" },
        });
      }
    } catch (e) {
      falhas += 1;
      logger.error("[cron.guia] empresa falhou", {
        orgId,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return NextResponse.json({ data: { empresas: orgs.length, criadas, medidas, falhas } });
}

export const GET = executar;
export const POST = executar;
