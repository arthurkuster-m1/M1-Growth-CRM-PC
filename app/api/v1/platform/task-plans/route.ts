/**
 * GET  /api/v1/platform/task-plans — planos da instalação (qualquer usuário autenticado).
 * PATCH /api/v1/platform/task-plans — atualiza os planos da instalação (platform admin full).
 *
 * Os planos da plataforma são visíveis a todos os tenants como referência (read-only para orgs).
 * Editáveis só por platform admin com scope=full.
 */
import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  falhaDaEscritaDePlatformAdmin,
  requirePlatformAdminEscrita,
} from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { lePlanosDoSettings, planosSchema } from "@/lib/tarefas/plano";

export const dynamic = "force-dynamic";

type LinhaDePlataforma = { task_plans?: unknown } | null;

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "platform_task_plans" });
  if (!authz.ok) return authz.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_branding")
    .select("task_plans")
    .eq("id", 1)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });

  return ok(
    { planos: lePlanosDoSettings({ task_plans: (data as LinhaDePlataforma)?.task_plans }) },
    { requestId },
  );
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  let ctx: Awaited<ReturnType<typeof requirePlatformAdminEscrita>>;
  try {
    ctx = await requirePlatformAdminEscrita();
  } catch (err) {
    return falhaDaEscritaDePlatformAdmin(err, requestId);
  }

  const t = (texto: string) => traduzir(texto, "pt-BR");

  const corpo = await req.json().catch(() => null);
  const parsed = planosSchema.safeParse(
    corpo && typeof corpo === "object" && !Array.isArray(corpo)
      ? (corpo as { planos?: unknown }).planos
      : undefined,
  );
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: Object.fromEntries(
        parsed.error.issues.map((p) => [p.path.map(String).join(".") || "raiz", p.message]),
      ),
    });
  }

  const admin = createAdminClient();

  // Garantir que a linha singleton existe antes de atualizar
  await admin.from("platform_branding").upsert({ id: 1 }, { onConflict: "id", ignoreDuplicates: true });

  const { error } = await admin
    .from("platform_branding")
    .update({ task_plans: parsed.data })
    .eq("id", 1);
  if (error) return fail("internal_error", error.message, 500, { requestId });

  void audit({
    action: "platform_task_plans.updated",
    actorUserId: ctx.user.id,
    organizationId: null,
    resourceType: "platform_branding",
    resourceId: "1",
    requestId,
    metadata: { planos: parsed.data.length } as unknown as Record<string, unknown>,
    actingAsPlatformAdmin: true,
  });

  return ok({ planos: parsed.data }, { requestId });
}
