/**
 * GET /api/v1/marketing/cronograma — config + itens do cronograma geral (a empresa toda lê).
 * PUT /api/v1/marketing/cronograma — grava a config (manager+).
 */
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import {
  COLUNAS_DA_CONFIG,
  COLUNAS_DA_META,
  COLUNAS_DO_ITEM,
  CONFIG_PADRAO,
  configSchema,
  type ConfigDoCronograma,
  type ItemDoCronograma,
  type MetaDoCronograma,
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
      .limit(300),
    a.supabase
      .from("marketing_cronograma_metas")
      .select(COLUNAS_DA_META)
      .eq("organization_id", a.orgId)
      .order("ordem", { ascending: true })
      .limit(12),
  ]);
  if (error)
    return fail("internal_error", a.t("Erro ao carregar o cronograma."), 500, {
      requestId: a.requestId,
    });
  return ok(
    {
      config: ((cfg as ConfigDoCronograma | null) ?? CONFIG_PADRAO) as ConfigDoCronograma,
      itens: (
        (itens ?? []) as Array<Omit<ItemDoCronograma, "ordem"> & { ordem: number | string }>
      ).map((i) => ({ ...i, ordem: Number(i.ordem) })),
      metas: (
        (metas ?? []) as Array<Omit<MetaDoCronograma, "ordem"> & { ordem: number | string }>
      ).map((m) => ({ ...m, ordem: Number(m.ordem) })),
      pode_editar: a.podeEditar,
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
  const { error } = await a.supabase
    .from("marketing_cronograma_config")
    .upsert(
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
