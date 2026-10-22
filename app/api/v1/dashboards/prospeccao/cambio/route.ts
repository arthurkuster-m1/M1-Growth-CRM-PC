/**
 * PUT /api/v1/dashboards/prospeccao/cambio — a cotação do dólar (usada só quando a automática está
 * fora do ar) e a alíquota de IOF do custo das extrações. Guardado em
 * `organizations.settings.dashboards.cambio` (manager+).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarCampanhas } from "@/lib/marketing/campanhas-servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  usd_brl: z.number().positive().max(100).nullable(),
  iof_pct: z.number().min(0).max(30),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  }
  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", a.orgId)
    .maybeSingle();
  const settings = (atual?.settings ?? {}) as Record<string, unknown>;
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...settings,
        dashboards: {
          ...((settings.dashboards as Record<string, unknown> | undefined) ?? {}),
          cambio: { usd_brl: corpo.data.usd_brl, iof_pct: corpo.data.iof_pct },
        },
      },
    })
    .eq("id", a.orgId);
  if (error) return fail("internal_error", a.t("Erro ao salvar."), 500, { requestId: a.requestId });
  return ok({ salvo: true }, { requestId: a.requestId });
}
