/**
 * POST /api/v1/demand-campaigns/[id]/sync-meta — puxa agora o dia a dia do Meta (manager+).
 * O relógio faz o mesmo de hora em hora (`/api/v1/cron/campanhas-meta`).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { campanhaDaLinha } from "@/lib/marketing/campanhas";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";
import { sincronizarCampanhaComMeta } from "@/lib/marketing/campanhas-meta-servidor";
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

  const r = await sincronizarCampanhaComMeta(createAdminClient(), {
    id: c.id,
    organization_id: a.orgId,
    start_date: c.start_date,
    end_date: c.end_date,
    meta_account_id: c.meta_account_id ?? "",
    platform_campaigns: c.platform_campaigns,
  });
  if (!r.ok) {
    // 422: o problema é do recurso (conexão, token, campanhas atreladas), não da sessão.
    return fail("meta_sync_failed", r.motivo, 422, { requestId: a.requestId });
  }
  return ok({ dias: r.dias, de: r.de, ate: r.ate }, { requestId: a.requestId });
}
