/**
 * GET /api/v1/marketing/cronograma/historico — o histórico de prazo e situação (manager+).
 * `?task_id=` = a linha do tempo de uma tarefa; `?inicio=YYYY-MM-DD` = o que aconteceu na semana;
 * `?adiadas=1&de=&ate=` = só os adiamentos (prazo empurrado para depois) num período qualquer.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { somarDias } from "@/lib/inicio/datas";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";

export const dynamic = "force-dynamic";

const COLUNAS =
  "id, task_id, tipo, de_prazo, para_prazo, situacao, motivo, semana_inicio, created_at, crm_tasks(title, cronograma_lado, prazo_original, adiamentos)";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCronograma("manager", false);
  if (!a.ok) return a.response;
  const taskId = req.nextUrl.searchParams.get("task_id");
  const inicio = req.nextUrl.searchParams.get("inicio");
  const soAdiadas = req.nextUrl.searchParams.get("adiadas") === "1";
  const de = req.nextUrl.searchParams.get("de");
  const ate = req.nextUrl.searchParams.get("ate");
  const dia = /^\d{4}-\d{2}-\d{2}$/;

  let consulta = a.supabase
    .from("crm_task_historico")
    .select(COLUNAS)
    .eq("organization_id", a.orgId)
    .order("created_at", { ascending: false })
    .limit(soAdiadas ? 2000 : 300);

  if (soAdiadas) {
    consulta = consulta.eq("tipo", "prazo_alterado");
    if (de && dia.test(de)) consulta = consulta.gte("created_at", `${de}T00:00:00-03:00`);
    if (ate && dia.test(ate)) {
      consulta = consulta.lt("created_at", `${somarDias(ate, 1)}T00:00:00-03:00`);
    }
  } else if (taskId) {
    if (!z.string().uuid().safeParse(taskId).success) {
      return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
    }
    consulta = consulta.eq("task_id", taskId);
  } else if (inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    consulta = consulta
      .gte("created_at", new Date(`${inicio}T00:00:00Z`).toISOString())
      .lt("created_at", new Date(`${somarDias(inicio, 7)}T00:00:00Z`).toISOString());
  }
  const { data, error } = await consulta;
  if (error)
    return fail("internal_error", a.t("Erro ao carregar o histórico."), 500, {
      requestId: a.requestId,
    });
  // Adiamento = o prazo foi empurrado para depois (adiantar o prazo não conta).
  const eventos = soAdiadas
    ? (data ?? []).filter(
        (e) =>
          typeof e.de_prazo === "string" &&
          typeof e.para_prazo === "string" &&
          e.para_prazo > e.de_prazo,
      )
    : (data ?? []);
  return ok({ eventos }, { requestId: a.requestId });
}
