/**
 * GET /api/v1/tags/existentes — as tags que já existem nos contatos da empresa (para escolher em
 * vez de digitar), mais usadas primeiro. Agent+.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("tags")
    .eq("organization_id", authz.org.orgId)
    .not("tags", "eq", "{}")
    .limit(5000);
  if (error) return fail("internal_error", "Erro ao carregar as tags.", 500, { requestId });
  const contagem = new Map<string, number>();
  for (const c of (data ?? []) as Array<{ tags: string[] | null }>) {
    for (const tag of c.tags ?? []) contagem.set(tag, (contagem.get(tag) ?? 0) + 1);
  }
  const tags = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
  return ok({ tags }, { requestId });
}
