/**
 * PATCH /api/v1/admin/tenants/[id]/team/[user_id] — troca o papel, revoga ou reativa um membro.
 *
 * Corpo: `{ role }` OU `{ revoked: true | false }` (um por vez, de propósito: reativar não
 * promove, como em /api/v1/team/[user_id]/reactivate). Mesmas travas das rotas da equipe:
 * não rebaixa nem revoga o ÚLTIMO admin da empresa. Visão do super-admin: o service role
 * filtra `organization_id` pelo CAMINHO, e a escrita exige escopo `full` + MFA.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import {
  falhaDaEscritaDePlatformAdmin,
  requirePlatformAdminEscrita,
  type PlatformAdminContext,
} from "@/lib/auth/requirePlatformAdmin";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { registrarTrocaDeComando } from "@/lib/inbox/atividade-de-comando";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpoSchema = z.union([
  z.object({ role: z.enum(["viewer", "agent", "manager", "admin"]) }).strict(),
  z.object({ revoked: z.boolean() }).strict(),
]);
const idSchema = z.string().uuid();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; user_id: string }> },
): Promise<Response> {
  const { id, user_id: alvoId } = await params;
  const supportDenied = await requireSupportWrite(id);
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  let adminCtx: PlatformAdminContext;
  try {
    adminCtx = await requirePlatformAdminEscrita();
  } catch (err) {
    return falhaDaEscritaDePlatformAdmin(err, requestId);
  }
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(alvoId).success) {
    return fail("not_found", "Membro não encontrado", 404, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }
  const parsed = corpoSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const admin = createAdminClient();
  const { data: alvo, error: erroBusca } = await admin
    .from("user_organizations")
    .select("id, user_id, role, revoked_at")
    .eq("organization_id", id)
    .eq("user_id", alvoId)
    .maybeSingle();
  if (erroBusca)
    return fail("internal_error", "Não foi possível carregar o membro", 500, { requestId });
  if (!alvo) return fail("not_found", "Membro não encontrado", 404, { requestId });

  const ultimoAdmin = async (): Promise<boolean | null> => {
    const { count, error } = await admin
      .from("user_organizations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id)
      .eq("role", "admin")
      .is("revoked_at", null);
    return error ? null : (count ?? 0) <= 1;
  };
  const agora = new Date().toISOString();

  // ── trocar papel ───────────────────────────────────────────────────────────
  if ("role" in parsed.data) {
    const novo = parsed.data.role;
    if (alvo.revoked_at) return fail("state_conflict", "Membro está revogado", 409, { requestId });
    if (alvo.role === "admin" && novo !== "admin") {
      const ultimo = await ultimoAdmin();
      if (ultimo === null)
        return fail("internal_error", "Falha ao conferir os admins", 500, { requestId });
      if (ultimo) {
        return fail("state_conflict", "Não é possível rebaixar o último admin da empresa", 409, {
          requestId,
        });
      }
    }
    const { error } = await admin
      .from("user_organizations")
      .update({ role: novo, updated_at: agora })
      .eq("id", alvo.id)
      .eq("organization_id", id);
    if (error) return fail("internal_error", "Não foi possível trocar o papel", 500, { requestId });
    await audit({
      action: "team.role_changed",
      actorUserId: adminCtx.user.id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      organizationId: id,
      resourceType: "membership",
      resourceId: alvo.id,
      requestId,
      metadata: { target_user_id: alvoId, old_role: alvo.role, new_role: novo },
    });
    return ok({ user_id: alvoId, role: novo }, { requestId });
  }

  // ── reativar ───────────────────────────────────────────────────────────────
  if (!parsed.data.revoked) {
    if (!alvo.revoked_at) return ok({ user_id: alvoId, already_active: true }, { requestId });
    const { error } = await admin
      .from("user_organizations")
      .update({ revoked_at: null, updated_at: agora })
      .eq("id", alvo.id)
      .eq("organization_id", id);
    if (error) return fail("internal_error", "Não foi possível reativar", 500, { requestId });
    await audit({
      action: "member.reactivated",
      actorUserId: adminCtx.user.id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      organizationId: id,
      resourceType: "membership",
      resourceId: alvo.id,
      requestId,
      metadata: { target_user_id: alvoId, restored_role: alvo.role },
    });
    return ok({ user_id: alvoId, reactivated_at: agora }, { requestId });
  }

  // ── revogar ────────────────────────────────────────────────────────────────
  if (alvo.revoked_at) return ok({ user_id: alvoId, already_revoked: true }, { requestId });
  if (alvo.role === "admin") {
    const ultimo = await ultimoAdmin();
    if (ultimo === null)
      return fail("internal_error", "Falha ao conferir os admins", 500, { requestId });
    if (ultimo) {
      return fail("state_conflict", "Não é possível revogar o último admin da empresa", 409, {
        requestId,
      });
    }
  }
  // Conversas abertas de quem sai: o trigger do banco as devolve à fila; aqui só se registra.
  const { data: abertas } = await admin
    .from("conversations")
    .select("id, contact_id")
    .eq("organization_id", id)
    .eq("assigned_to_user_id", alvoId)
    .in("status", ["open", "pending", "claimed", "ai_handling"]);
  const { error } = await admin
    .from("user_organizations")
    .update({ revoked_at: agora, updated_at: agora })
    .eq("id", alvo.id)
    .eq("organization_id", id);
  if (error) return fail("internal_error", "Não foi possível revogar", 500, { requestId });

  for (const conv of abertas ?? []) {
    await audit({
      action: "conversation.released",
      actorUserId: adminCtx.user.id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      organizationId: id,
      resourceType: "conversation",
      resourceId: conv.id,
      requestId,
      metadata: { reason: "member_revoked", target_user_id: alvoId },
    });
    await registrarTrocaDeComando({
      supabase: admin,
      organizationId: id,
      conversationId: conv.id,
      contactId: conv.contact_id,
      tipo: "conversation_released",
      actor: { type: "user", id: adminCtx.user.id, role: "admin" },
      motivo: "Atendente revogado da organização",
    });
  }
  await audit({
    action: "member.revoked",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: id,
    resourceType: "membership",
    resourceId: alvo.id,
    requestId,
    metadata: {
      target_user_id: alvoId,
      revoked_role: alvo.role,
      released_conversations_count: abertas?.length ?? 0,
    },
  });
  return ok({ user_id: alvoId, revoked_at: agora }, { requestId });
}
