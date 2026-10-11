/** GET /api/v1/marketing/cronograma/disponiveis?q= — tarefas abertas da base que ainda NÃO estão no cronograma. */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCronograma("manager", false);
  if (!a.ok) return a.response;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  let consulta = a.supabase
    .from("crm_tasks")
    .select("id, title, due_date")
    .eq("organization_id", a.orgId)
    .is("cronograma_lado", null)
    .in("status", ["pending", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(30);
  if (q) consulta = consulta.ilike("title", `%${q.replace(/[%_]/g, " ")}%`);
  const { data, error } = await consulta;
  if (error)
    return fail("internal_error", a.t("Erro ao carregar as tarefas."), 500, {
      requestId: a.requestId,
    });
  return ok({ tarefas: data ?? [] }, { requestId: a.requestId });
}
