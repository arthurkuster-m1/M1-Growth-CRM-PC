import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  falhaDaEscritaDePlatformAdmin,
  requirePlatformAdminEscrita,
  type PlatformAdminContext,
} from "@/lib/auth/requirePlatformAdmin";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { normalizarHex } from "@/lib/branding/rampa";
import { updateTenantSchema } from "@/lib/schemas/tenant-update";

// ---------------------------------------------------------------------------
// GET /api/v1/admin/tenants/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const { id } = await params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const admin = createAdminClient();

  // Load the organization (service-role bypasses RLS — intentional cross-tenant)
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select(
      `
      id,
      slug,
      display_name,
      legal_name,
      cnpj,
      status,
      timezone,
      locale,
      currency,
      country,
      dpo_email,
      privacy_policy_url,
      ai_budget_cents,
      media_retention_days,
      interface_settings,
      onboarded_at,
      suspended_at,
      suspended_reason,
      created_at,
      settings
    `,
    )
    .eq("id", id)
    .single();

  if (orgError || !org) {
    return fail("not_found", "Tenant not found", 404, { requestId });
  }

  // Run counts in parallel — service role, all cross-tenant reads are intentional
  const [
    usersRes,
    conversationsRes,
    messagesRes,
    leadsRes,
    ordersRes,
    lgpdRes,
    aiRes,
    wahaRes,
  ] = await Promise.all([
    admin
      .from("user_organizations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("crm_leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("lgpd_requests")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id)
      // `pending` não existe em `lgpd_requests_status_check`
      // (received/processing/completed/failed/expired), então este contador era
      // sempre 0 e a tela jurava que o tenant não devia nada à LGPD. Aqui
      // pendente = TUDO que ainda não fechou, sem recorte de prazo. O KPI de
      // plataforma (`app/api/v1/admin/dashboard/kpis/route.ts`) parte do mesmo
      // "não fechado" mas soma só o que vence nos próximos 5 dias — os dois
      // números divergem de propósito: este é o total do tenant, aquele é a
      // fila de SLA da plataforma.
      .not("status", "in", "(completed,failed)"),
    // `llm_calls` e não `ai_invocations`: a migration 0130 deixou a segunda sem
    // nenhum escritor (`lib/ai/log-invocation.ts` passou a gravar na primeira).
    // Lendo a tabela morta, este contador viraria ZERO em 30 dias para todo
    // tenant — com o dinheiro saindo. É o mesmo sintoma que a 0130 veio matar.
    admin
      .from("llm_calls")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    admin
      .from("channel_sessions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", id),
  ]);

  const counts = {
    user_count: usersRes.count ?? 0,
    conversations_count: conversationsRes.count ?? 0,
    messages_count: messagesRes.count ?? 0,
    leads_count: leadsRes.count ?? 0,
    orders_count: ordersRes.count ?? 0,
    lgpd_requests_pending: lgpdRes.count ?? 0,
    ai_invocations_30d: aiRes.count ?? 0,
    waha_sessions_count: wahaRes.count ?? 0,
  };

  // Audit lightweight — fire-and-forget
  void audit({
    action: "platform_admin.tenant_viewed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: id,
    resourceType: "organization",
    resourceId: id,
    requestId,
    metadata: { tenant_slug: org.slug },
  });

  return ok({ organization: org, counts }, { requestId });
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/tenants/[id]
//
// Edita o cadastro da empresa (platform admin com escrita). Fora daqui, de
// propósito: `slug` (só leitura), `status`/suspensão (rotas `suspend` e
// `reactivate`, que passam pela função definer — o trigger
// `trg_organizacao_estado_so_pelo_servidor` protege essas colunas) e a marca.
// O id vem do caminho; o service role filtra por ele, nunca por algo do body.
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  if (!z.string().uuid().safeParse(id).success) {
    return fail("not_found", "Tenant not found", 404, { requestId });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("validation_error", "Invalid JSON body", 400, { requestId });
  }
  const parsed = updateTenantSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", "Invalid request body", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const admin = createAdminClient();
  const { marca, ...colunas } = parsed.data;

  // Existência (e slug para a trilha) primeiro: a marca e as colunas são
  // escritas separadas, e nenhuma deve rodar contra uma empresa que não existe.
  let updated: { id: string; slug: string; display_name: string } | null;
  if (Object.keys(colunas).length > 0) {
    const { data, error } = await admin
      .from("organizations")
      .update(colunas)
      .eq("id", id)
      .select("id, slug, display_name")
      .maybeSingle();
    if (error) {
      return fail("internal_error", "Não foi possível salvar a empresa", 500, { requestId });
    }
    updated = data;
  } else {
    const { data } = await admin
      .from("organizations")
      .select("id, slug, display_name")
      .eq("id", id)
      .maybeSingle();
    updated = data;
  }
  if (!updated) {
    return fail("not_found", "Tenant not found", 404, { requestId });
  }

  if (marca !== undefined) {
    const vazia = marca === null || (marca.app_name === null && marca.accent_hex === null);
    const { data: linhas, error: marcaError } = await admin.rpc("fn_definir_marca_da_organizacao", {
      p_org: id,
      p_actor: adminCtx.user.id,
      p_marca: vazia
        ? null
        : {
            app_name: marca.app_name,
            accent_hex: marca.accent_hex === null ? null : normalizarHex(marca.accent_hex),
            updated_by: adminCtx.user.id,
            updated_at: new Date().toISOString(),
          },
    });
    if (marcaError || linhas !== 1) {
      return fail("internal_error", "Não foi possível salvar a marca da empresa", 500, {
        requestId,
      });
    }
  }

  void audit({
    action: "tenant.updated_by_platform_admin",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    organizationId: id,
    resourceType: "organization",
    resourceId: id,
    requestId,
    // Só os NOMES dos campos: valores (CNPJ, e-mail do DPO) não entram na trilha.
    metadata: { tenant_slug: updated.slug, fields_changed: Object.keys(parsed.data) },
  });

  return ok({ id: updated.id, slug: updated.slug, display_name: updated.display_name }, { requestId });
}
