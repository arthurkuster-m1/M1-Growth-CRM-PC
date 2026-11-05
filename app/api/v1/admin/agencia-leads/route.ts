/**
 * GET /api/v1/admin/agencia-leads?q=texto — as oportunidades do CRM DA AGÊNCIA, para ligar uma
 * empresa nova (ou existente) ao seu lead.
 *
 * "A agência" = a organização ATIVA de quem pede (resolvida no servidor, pelo cookie — nunca por
 * parâmetro). Só platform admin. A busca é por título; no máximo 20 resultados.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({ q: z.string().trim().max(80).optional() });

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) return fail("validation_error", "Invalid query params", 400, { requestId });

  const user = await loadAuthUser();
  const agencia = user ? await resolveActiveOrg(user) : null;
  if (!agencia) return ok({ agencia: null, leads: [] }, { requestId });

  let query = createAdminClient()
    .from("crm_leads")
    .select("id, title, status, contact:contacts(name, email)")
    .eq("organization_id", agencia.orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  const q = parsed.data.q;
  if (q) query = query.ilike("title", `%${q.replace(/[%_,()]/g, " ")}%`);

  const { data, error } = await query;
  if (error)
    return fail("internal_error", "Não foi possível carregar os leads", 500, { requestId });

  const leads = (
    (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      status: string;
      contact: { name: string | null; email: string | null } | null;
    }>
  ).map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    contact_name: l.contact?.name ?? null,
    contact_email: l.contact?.email ?? null,
  }));
  return ok({ agencia: { id: agencia.orgId, name: agencia.name }, leads }, { requestId });
}
