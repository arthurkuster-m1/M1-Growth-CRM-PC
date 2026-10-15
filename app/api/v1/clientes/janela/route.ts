/**
 * GET/PATCH /api/v1/clientes/janela — a janela PADRÃO de "cliente ativo" da empresa, em meses
 * (`organizations.settings.janela_ativo_meses`; padrão 6). Vale para o produto que não define a
 * própria (`marketing_pages.janela_ativo_meses`). Mudar recalcula o ciclo de vida de todos.
 * Ler: viewer+. Mudar: manager+.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PADRAO = 6;

const corpo = z.object({ meses: z.number().int().min(1).max(60) });

async function ler(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const bruto = Number((data?.settings as Record<string, unknown> | null)?.janela_ativo_meses);
  return Number.isFinite(bruto) && bruto >= 1 && bruto <= 60 ? Math.round(bruto) : PADRAO;
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  return ok({ meses: await ler(authz.org.orgId) }, { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Informe de 1 a 60 meses.", 422, { requestId });

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  const settings = { ...((org?.settings as Record<string, unknown> | null) ?? {}), janela_ativo_meses: parsed.data.meses };
  const { error } = await admin.from("organizations").update({ settings }).eq("id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível salvar.", 500, { requestId });

  await admin.rpc("fn_ciclo_recalcula_todos" as never, { p_org: authz.org.orgId } as never);
  return ok({ meses: parsed.data.meses }, { requestId });
}
