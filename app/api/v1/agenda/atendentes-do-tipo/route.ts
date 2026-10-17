import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Quem faz cada tipo de atendimento (a matriz pessoas × tipos da Configuração da Agenda). */
export async function GET() {
  const requestId = randomUUID();
  const auth = await requireRole("agent", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const org = auth.org.orgId;
  const db = await createClient();
  const [{ data: tipos }, { data: linhas, error }, { data: membros }, { data: conexoes }] = await Promise.all([
    db
      .from("calendar_event_types")
      .select("id, name, default_owner_user_id")
      .eq("organization_id", org)
      .eq("is_active", true)
      .order("name"),
    db
      .from("calendar_event_type_attendants")
      .select("event_type_id, user_id, priority, is_active")
      .eq("organization_id", org),
    db.from("user_organizations").select("user_id, role").eq("organization_id", org).is("revoked_at", null),
    db
      .from("calendar_connections")
      .select("user_id")
      .eq("organization_id", org)
      .eq("status", "healthy")
      .eq("provider", "google_calendar"),
  ]);
  return ok(
    {
      // Sem a tabela (migration 0649 ainda não aplicada), a tela mostra só o responsável padrão.
      tabela_existe: !error,
      tipos: (tipos ?? []).map((t) => ({
        id: t.id as string,
        nome: t.name as string,
        responsavel_padrao: (t.default_owner_user_id as string | null) ?? null,
      })),
      matriz: error ? [] : (linhas ?? []),
      membros: (membros ?? []).map((m) => ({ user_id: m.user_id as string, role: m.role as string })),
      com_google: (conexoes ?? []).map((c) => c.user_id as string),
    },
    { requestId },
  );
}

const corpo = z.object({
  event_type_id: z.string().uuid(),
  atendentes: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        priority: z.number().int().min(0).max(10000).default(100),
        is_active: z.boolean().default(true),
      }),
    )
    .max(100),
});

/** Troca TODOS os atendentes de um tipo de uma vez. Só gerente ou acima. */
export async function PUT(req: Request) {
  const requestId = randomUUID();
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const auth = await requireRole("manager", { requestId, resource: "agenda" });
  if (!auth.ok) return auth.response;
  const body = corpo.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("validation_failed", "Dados inválidos.", 422, { requestId });
  const org = auth.org.orgId;
  const admin = createAdminClient();
  const { data: tipo } = await admin
    .from("calendar_event_types")
    .select("id")
    .eq("organization_id", org)
    .eq("id", body.data.event_type_id)
    .maybeSingle();
  if (!tipo) return fail("not_found", "Tipo de atendimento não encontrado.", 404, { requestId });
  const ids = body.data.atendentes.map((a) => a.user_id);
  if (ids.length > 0) {
    const { data: membros } = await admin
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", org)
      .in("user_id", ids)
      .is("revoked_at", null);
    if ((membros ?? []).length !== new Set(ids).size)
      return fail("validation_failed", "Há pessoas que não são da equipe.", 422, { requestId });
  }
  const { error: e1 } = await admin
    .from("calendar_event_type_attendants")
    .delete()
    .eq("organization_id", org)
    .eq("event_type_id", body.data.event_type_id);
  if (e1)
    return fail("internal_error", "Não foi possível salvar. A migration 0649 já foi aplicada?", 500, {
      requestId,
    });
  if (body.data.atendentes.length > 0) {
    const { error: e2 } = await admin.from("calendar_event_type_attendants").insert(
      body.data.atendentes.map((a) => ({
        organization_id: org,
        event_type_id: body.data.event_type_id,
        user_id: a.user_id,
        priority: a.priority,
        is_active: a.is_active,
      })),
    );
    if (e2) return fail("internal_error", "Não foi possível salvar os atendentes.", 500, { requestId });
  }
  void audit({
    action: "agenda.appointment_updated",
    actorUserId: auth.user.id,
    organizationId: org,
    resourceType: "calendar_event_type",
    resourceId: body.data.event_type_id,
    requestId,
    metadata: { atendentes: ids.length },
  });
  return ok({ event_type_id: body.data.event_type_id, atendentes: ids.length }, { requestId });
}
