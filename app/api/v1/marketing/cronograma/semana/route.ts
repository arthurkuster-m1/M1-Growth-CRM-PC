/**
 * GET /api/v1/marketing/cronograma/semana?inicio=YYYY-MM-DD — as tarefas da semana do cliente:
 * as da base de Tarefas marcadas para o cronograma, do prazo da semana (e as atrasadas abertas).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { somarDias } from "@/lib/inicio/datas";
import {
  COLUNAS_DA_TAREFA_NO_CRONOGRAMA,
  domingoDe,
  domingoDeHoje,
  tarefaDoCronograma,
  tarefasDaSemana,
} from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const a = await autorizarCronograma("viewer", false);
  if (!a.ok) return a.response;
  const pedido = req.nextUrl.searchParams.get("inicio") ?? "";
  const domingo = /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? domingoDe(pedido) : domingoDeHoje();

  // Janela larga (as atrasadas vêm de antes); o recorte fino é feito em `tarefasDaSemana`.
  const de = new Date(`${somarDias(domingo, -1)}T00:00:00Z`).toISOString();
  const ate = new Date(`${somarDias(domingo, 8)}T00:00:00Z`).toISOString();
  const { data, error } = await a.supabase
    .from("crm_tasks")
    .select(COLUNAS_DA_TAREFA_NO_CRONOGRAMA)
    .eq("organization_id", a.orgId)
    .not("cronograma_lado", "is", null)
    .gte("due_date", de)
    .lte("due_date", ate)
    .order("due_date", { ascending: true })
    .limit(500);
  if (error)
    return fail("internal_error", a.t("Erro ao carregar as tarefas."), 500, {
      requestId: a.requestId,
    });

  const todas = ((data ?? []) as Array<Parameters<typeof tarefaDoCronograma>[0]>).map(
    tarefaDoCronograma,
  );
  return ok(
    { inicio: domingo, tarefas: tarefasDaSemana(todas, domingo) },
    { requestId: a.requestId },
  );
}
