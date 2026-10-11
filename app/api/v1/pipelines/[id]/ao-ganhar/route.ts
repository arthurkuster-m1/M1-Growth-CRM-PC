import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PUT /api/v1/pipelines/[id]/ao-ganhar — para qual funil o lead vai quando ganha um negócio
 * neste (ex.: Tráfego → Pós-venda). `{ funil_destino_id: uuid | null }`; `null` desliga.
 * O efeito é do trigger `fn_lead_ganhou_entra_no_funil` (migration 0594). Manager+.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ funil_destino_id: z.string().uuid().nullable() });

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "crm_pipelines",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const pipelineId = z
    .string()
    .uuid()
    .safeParse((await ctx.params).id);
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!pipelineId.success || !corpo.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }
  const destino = corpo.data.funil_destino_id;
  if (destino === pipelineId.data) {
    return fail("validation_failed", t("O funil de destino precisa ser outro."), 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data: origem } = await supabase
    .from("crm_pipelines")
    .select("id, settings")
    .eq("id", pipelineId.data)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!origem) return fail("not_found", t("Funil não encontrado."), 404, { requestId });

  if (destino) {
    const { data: alvo } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("id", destino)
      .eq("organization_id", authz.org.orgId)
      .eq("is_archived", false)
      .maybeSingle();
    if (!alvo) return fail("not_found", t("Funil de destino não encontrado."), 404, { requestId });
  }

  const atual = ((origem as { settings: Record<string, unknown> | null }).settings ?? {}) as Record<
    string,
    unknown
  >;
  const { ao_ganhar_funil_id: _antigo, ...resto } = atual;
  void _antigo;
  const novo = destino ? { ...resto, ao_ganhar_funil_id: destino } : resto;

  const { error } = await supabase
    .from("crm_pipelines")
    .update({ settings: novo })
    .eq("id", pipelineId.data)
    .eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "pipeline.updated",
    resourceType: "crm_pipeline",
    resourceId: pipelineId.data,
    requestId,
    metadata: { ao_ganhar_funil_id: destino },
  });
  return ok({ funil_destino_id: destino }, { requestId });
}
