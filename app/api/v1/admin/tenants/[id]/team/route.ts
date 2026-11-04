/**
 * GET  /api/v1/admin/tenants/[id]/team — membros e convites pendentes da empresa.
 * POST /api/v1/admin/tenants/[id]/team — convida uma pessoa (e-mail + papel).
 *
 * Visão do super-admin: o service role atravessa as empresas, então CADA consulta filtra
 * `organization_id` pelo id do CAMINHO (nunca do body). A escrita exige escopo `full`,
 * MFA em dia e passa por `requireSupportWrite` antes do efeito.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import {
  falhaDaEscritaDePlatformAdmin,
  requirePlatformAdmin,
  requirePlatformAdminEscrita,
  type PlatformAdminContext,
} from "@/lib/auth/requirePlatformAdmin";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { interfaceSettingsSchema, interfaceTemDestino } from "@/lib/navigation/interface";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirConvite } from "@/lib/team/convites";

export const dynamic = "force-dynamic";

const ROLES = ["viewer", "agent", "manager", "admin"] as const;
const idSchema = z.string().uuid();

const conviteSchema = z
  .object({
    email: z.string().trim().email().max(255),
    role: z.enum(ROLES),
    interface_settings: interfaceSettingsSchema.optional(),
  })
  .strict()
  .refine((v) => !v.interface_settings || interfaceTemDestino(v.interface_settings, v.role), {
    message: "Selecione ao menos uma área permitida ao papel.",
    path: ["interface_settings"],
  });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await params;
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }
  if (!idSchema.safeParse(id).success)
    return fail("not_found", "Tenant not found", 404, { requestId });

  const admin = createAdminClient();
  const [membrosRes, convitesRes] = await Promise.all([
    admin
      .from("user_organizations")
      .select("user_id, role, invited_at, accepted_at, revoked_at, created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("team_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (membrosRes.error || convitesRes.error) {
    return fail("internal_error", "Não foi possível carregar a equipe", 500, { requestId });
  }

  const membros = await Promise.all(
    (membrosRes.data ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id as string);
      const u = data?.user;
      return {
        ...m,
        email: u?.email ?? null,
        full_name: (u?.user_metadata?.full_name as string | undefined) ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
      };
    }),
  );
  return ok({ members: membros, invites: convitesRes.data ?? [] }, { requestId });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const supportDenied = await requireSupportWrite(id);
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  let adminCtx: PlatformAdminContext;
  try {
    adminCtx = await requirePlatformAdminEscrita();
  } catch (err) {
    return falhaDaEscritaDePlatformAdmin(err, requestId);
  }
  if (!idSchema.safeParse(id).success)
    return fail("not_found", "Tenant not found", 404, { requestId });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }
  const parsed = conviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const email = parsed.data.email.toLowerCase();

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, display_name, status")
    .eq("id", id)
    .maybeSingle();
  if (!org) return fail("not_found", "Tenant not found", 404, { requestId });

  // Quem já é membro ATIVO não recebe convite de novo (mesma regra de /api/v1/team/invite).
  const { data: ativos } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", id)
    .is("revoked_at", null);
  for (const m of ativos ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.user_id as string);
    if (data?.user?.email?.trim().toLowerCase() === email) {
      return fail("conflict", "Esta pessoa já faz parte da equipe", 409, { requestId });
    }
  }

  const { convite, accept_url, email_dispatched, email_error } = await emitirConvite(admin, {
    email,
    role: parsed.data.role,
    interfaceSettings: parsed.data.interface_settings,
    organizationId: id,
    orgName: org.display_name as string,
    inviterId: adminCtx.user.id,
    inviterName:
      (adminCtx.user.user_metadata?.full_name as string | undefined) ??
      adminCtx.user.email ??
      "Administrador",
    requestId,
  });
  return ok(
    {
      email,
      invite_id: convite.id,
      expires_at: convite.expires_at,
      email_dispatched,
      email_error,
      accept_url,
    },
    { status: 201, requestId },
  );
}
