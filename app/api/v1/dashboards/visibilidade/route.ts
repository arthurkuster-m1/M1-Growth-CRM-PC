/**
 * GET — quais dashboards a empresa esconde (todo membro lê: a tela monta as abas com isto).
 * PUT — o Super ADM (administrador da plataforma) escolhe quais dashboards esta empresa não usa.
 * Guardado em `organizations.settings.dashboards.ocultos`, mesclando o resto do `settings`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { clienteDaRequisicao, ehRecusa } from "@/lib/agencia/cliente-da-requisicao";
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
  // MODO AGÊNCIA: a empresa de outro cliente (reconferida no servidor).
  const outro = await clienteDaRequisicao(authz.user, authz.org.orgId, false, (x) => x, requestId);
  if (outro && ehRecusa(outro)) return outro.response;
  const orgAlvo = outro?.orgId ?? authz.org.orgId;
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgAlvo)
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
  // MODO AGÊNCIA: a empresa de outro cliente (reconferida no servidor).
  const outro = await clienteDaRequisicao(authz.user, authz.org.orgId, true, (x) => x, requestId);
  if (outro && ehRecusa(outro)) return outro.response;
  const orgAlvo = outro?.orgId ?? authz.org.orgId;

  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgAlvo)
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
    .eq("id", orgAlvo);
  if (error) return fail("internal_error", "Erro ao salvar.", 500, { requestId });
  await audit({
    organizationId: orgAlvo,
    actorUserId: authz.user.id,
    action: "dashboards.visibility_changed",
    resourceType: "organizations",
    resourceId: orgAlvo,
    requestId,
    metadata: { antes: anteriores, depois: ocultos },
  });
  return ok({ ocultos }, { requestId });
}
