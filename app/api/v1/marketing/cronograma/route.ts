/**
 * GET /api/v1/marketing/cronograma — config + itens do cronograma geral (a empresa toda lê).
 * PUT /api/v1/marketing/cronograma — grava a config (manager+).
 */
import { aplicarMetasAutomaticas } from "@/lib/marketing/metas-automaticas";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import {
  COLUNAS_DA_CONFIG,
  COLUNAS_DA_META,
  COLUNAS_DO_ITEM,
  CONFIG_PADRAO,
  configSchema,
  type ConfigDoCronograma,
  itemDaLinha,
  metaDaLinha,
  type TarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { autorizarCronograma } from "@/lib/marketing/cronograma-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const a = await autorizarCronograma("viewer", false);
  if (!a.ok) return a.response;
  const [{ data: cfg }, { data: itens, error }, { data: metas }] = await Promise.all([
    a.supabase
      .from("marketing_cronograma_config")
      .select(COLUNAS_DA_CONFIG)
      .eq("organization_id", a.orgId)
      .maybeSingle(),
    a.supabase
      .from("marketing_cronograma_itens")
      .select(COLUNAS_DO_ITEM)
      .eq("organization_id", a.orgId)
      .order("ordem", { ascending: true })
      .limit(520),
    a.supabase
      .from("marketing_cronograma_metas")
      .select(COLUNAS_DA_META)
      .eq("organization_id", a.orgId)
      .order("ordem", { ascending: true })
      .limit(12),
  ]);
  // As tarefas ligadas às ações (migration 0693). Sem ela, a coluna não existe: segue sem vínculos.
  const { data: ligadas } = await a.supabase
    .from("crm_tasks")
    .select("id, title, status, due_date, cronograma_item_id")
    .eq("organization_id", a.orgId)
    .not("cronograma_item_id", "is", null)
    .neq("status", "cancelled")
    .order("due_date", { ascending: true })
    .limit(1000);
  if (error)
    return fail("internal_error", a.t("Erro ao carregar o cronograma."), 500, {
      requestId: a.requestId,
    });
  return ok(
    {
      config: ((cfg as ConfigDoCronograma | null) ?? CONFIG_PADRAO) as ConfigDoCronograma,
      itens: ((itens ?? []) as Array<Record<string, unknown>>).map(itemDaLinha),
      // As metas ligadas ao CRM trazem o número real (o cronograma é da própria empresa).
      metas: await aplicarMetasAutomaticas(
        createAdminClient(),
        a.orgId,
        ((metas ?? []) as Array<Record<string, unknown>>).map(metaDaLinha),
      ),
      pode_editar: a.podeEditar,
      ligadas: ((ligadas ?? []) as unknown as Array<Record<string, unknown>>).map((l) => ({
        id: String(l.id),
        title: String(l.title),
        status: l.status as TarefaDoCronograma["status"],
        due_date: (l.due_date as string | null) ?? null,
        item_id: String(l.cronograma_item_id),
      })),
    },
    { requestId: a.requestId },
  );
}

export async function PUT(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCronograma("manager", true);
  if (!a.ok) return a.response;
  const corpo = configSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success)
    return fail("validation_failed", a.t("Dados inválidos."), 422, { requestId: a.requestId });
  const { error } = await a.supabase.from("marketing_cronograma_config").upsert(
    {
      organization_id: a.orgId,
      ...corpo.data,
      updated_by: a.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error)
    return fail("internal_error", a.t("Erro ao salvar o cronograma."), 500, {
      requestId: a.requestId,
    });
  return ok({ config: corpo.data }, { requestId: a.requestId });
}
