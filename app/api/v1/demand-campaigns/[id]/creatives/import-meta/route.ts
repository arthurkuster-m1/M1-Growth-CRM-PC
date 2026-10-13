/**
 * POST /api/v1/demand-campaigns/[id]/creatives/import-meta — traz do Meta os anúncios das
 * campanhas atreladas (nome, título, legenda, miniatura, formato) e atualiza as métricas de
 * entrega (gasto, impressões, cliques, visitas à LP). Não duplica pelo id do anúncio (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { campanhaDaLinha } from "@/lib/marketing/campanhas";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import {
  atualizarMetricasDosCriativos,
  importarCriativosDoMeta,
} from "@/lib/marketing/criativos-servidor";
import {
  contaLiberada,
  lerCredencialDeLeitura,
} from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data } = await a.supabase
    .from("demand_campaigns")
    .select("id, start_date, end_date, meta_account_id, platform_campaigns")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!data) return campanhaNaoEncontrada(a.t, a.requestId);
  const c = campanhaDaLinha(data as Record<string, unknown>);
  const ids = c.platform_campaigns.flatMap((p) => (p.id ? [p.id] : []));
  if (ids.length === 0) {
    return fail("meta_sync_failed", "sem_campanhas", 422, { requestId: a.requestId });
  }

  const admin = createAdminClient();
  const credencial = await lerCredencialDeLeitura(admin, a.orgId, "meta_ads");
  if (!credencial.ok)
    return fail("meta_sync_failed", "sem_conexao", 422, { requestId: a.requestId });
  const token = credencial.credencial.accessToken;
  const alvo = {
    id: c.id,
    organization_id: a.orgId,
    start_date: c.start_date,
    end_date: c.end_date,
  };

  const conta = c.meta_account_id || credencial.credencial.contaPadrao;
  const contaDaImportacao = conta && contaLiberada(credencial.credencial, conta) ? conta : null;
  const r = await importarCriativosDoMeta(admin, alvo, token, ids, a.userId, contaDaImportacao);
  if (!r.ok) return fail("meta_sync_failed", r.falha, 422, { requestId: a.requestId });

  if (conta && contaLiberada(credencial.credencial, conta))
    await atualizarMetricasDosCriativos(admin, alvo, token, conta, ids);
  return ok({ criados: r.criados, existentes: r.existentes }, { requestId: a.requestId });
}
