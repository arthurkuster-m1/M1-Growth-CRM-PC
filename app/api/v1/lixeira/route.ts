/**
 * GET /api/v1/lixeira — os clientes excluídos nos últimos 7 dias (agent+), do mais recente ao mais
 * antigo, com o que levaram junto (resumo) e quando somem de vez.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_lixeira")
    .select("id, tipo, contact_id, nome, telefone, email, resumo, excluido_em, expira_em")
    .eq("organization_id", authz.org.orgId)
    .gt("expira_em", new Date().toISOString())
    .order("excluido_em", { ascending: false })
    .limit(500);
  if (error) return fail("internal_error", "Erro ao carregar a lixeira.", 500, { requestId });
  return ok({ itens: data ?? [] }, { requestId });
}
