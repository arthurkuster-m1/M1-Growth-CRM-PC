/**
 * GET — quais dashboards a empresa esconde (todo membro lê: a tela monta as abas com isto).
 * PUT — o Super ADM (administrador da plataforma) escolhe quais dashboards esta empresa não usa.
 * Guardado em `organizations.settings.dashboards.ocultos`, mesclando o resto do `settings`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  falhaDaEscritaDePlatformAdmin,
  requirePlatformAdminEscrita,
} from "@/lib/auth/requirePlatformAdmin";
import { PAINEIS, lerOcultos } from "@/lib/dashboards/visibilidade";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({ ocultos: z.array(z.enum(PAINEIS)).max(PAINEIS.length) });

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  return ok(
    { ocultos: lerOcultos(data?.settings), podeEditar: authz.user.is_platform_admin },
    { requestId },
  );
}

export async function PUT(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  // Quem escolhe os dashboards é o administrador da plataforma (escrita exige escopo completo e
  // MFA em dia); a empresa é a ativa da sessão, nunca vinda do corpo.
  const authz = await requireRole("viewer", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;
  try {
    await requirePlatformAdminEscrita();
  } catch (err) {
    return falhaDaEscritaDePlatformAdmin(err, requestId);
  }
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", "Lista inválida.", 422, { requestId });

  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  const settings = (atual?.settings ?? {}) as Record<string, unknown>;
  const anteriores = lerOcultos(settings);
  const ocultos = PAINEIS.filter((id) => corpo.data.ocultos.includes(id));
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...settings,
        dashboards: {
          ...((settings.dashboards as Record<string, unknown> | undefined) ?? {}),
          ocultos,
        },
      },
    })
    .eq("id", authz.org.orgId);
  if (error) return fail("internal_error", "Erro ao salvar.", 500, { requestId });
  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "dashboards.visibility_changed",
    resourceType: "organizations",
    resourceId: authz.org.orgId,
    requestId,
    metadata: { antes: anteriores, depois: ocultos },
  });
  return ok({ ocultos }, { requestId });
}
