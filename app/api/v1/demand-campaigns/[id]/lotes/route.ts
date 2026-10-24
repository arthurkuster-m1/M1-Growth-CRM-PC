/**
 * GET /api/v1/demand-campaigns/[id]/lotes — o REGISTRO de lotes da campanha: cada extração de
 * leads (busca na Apify) e cada importação de planilha, do mais novo ao mais antigo, com a data,
 * os termos, a cidade ou o arquivo, e o resultado.
 *
 * Sem tabela própria para as extrações: elas já vivem em `prospecting_campaigns` (ligadas à
 * campanha por `demand_campaign_id`); aqui só se lê e se junta com as importações.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";

import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { fail, ok } from "@/lib/api/wrappers";
import type { LoteDaCampanha } from "@/lib/marketing/lotes";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const a = await autorizarCampanhas("viewer", false);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: campanha } = await a.supabase
    .from("demand_campaigns")
    .select("id")
    .eq("id", id)
    .eq("organization_id", a.orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(a.t, a.requestId);

  const { data: importacoes, error } = await a.supabase
    .from("demand_lead_imports")
    .select("id, file_name, total_rows, created_count, existing_count, invalid_count, created_at")
    .eq("organization_id", a.orgId)
    .eq("demand_campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fail("internal_error", error.message, 500, { requestId: a.requestId });

  const lotes: LoteDaCampanha[] = (
    (importacoes ?? []) as Array<{
      id: string;
      file_name: string;
      total_rows: number;
      created_count: number;
      existing_count: number;
      invalid_count: number;
      created_at: string;
    }>
  ).map((i) => ({
    id: i.id,
    tipo: "importacao",
    em: i.created_at,
    termos: i.file_name,
    cidade: null,
    limite: null,
    custo_usd: null,
    estado: null,
    modo: null,
    novos: i.created_count,
    repetidos: i.existing_count,
    invalidos: i.invalid_count,
    linhas: i.total_rows,
  }));

  // As extrações vivem em tabela de servidor (sem acesso do navegador): leitura pelo pool, sempre
  // com a organização da sessão no filtro.
  try {
    const { rows } = await getRequestPool().query<{
      id: string;
      search: { niche?: string; location?: string; limit?: number; mode?: string };
      search_status: string;
      cost_usd: string | null;
      result_count: number;
      skipped_count: number;
      created_at: Date;
    }>(
      "select id, search, search_status, cost_usd, result_count, skipped_count, created_at from prospecting_campaigns where organization_id=$1 and demand_campaign_id=$2 order by created_at desc limit 200",
      [a.orgId, id],
    );
    for (const e of rows) {
      lotes.push({
        id: e.id,
        tipo: "extracao",
        em: new Date(e.created_at).toISOString(),
        termos: e.search?.niche ?? "",
        cidade: e.search?.location ?? null,
        limite: typeof e.search?.limit === "number" ? e.search.limit : null,
        custo_usd: e.cost_usd === null ? null : Number(e.cost_usd),
        estado: e.search_status,
        modo: e.search?.mode === "volume" ? "volume" : "completo",
        novos: e.result_count,
        repetidos: e.skipped_count,
        invalidos: 0,
        linhas: null,
      });
    }
  } catch {
    // Sem leitura das extrações o registro ainda mostra as importações: melhor que nada.
  }

  lotes.sort((x, y) => y.em.localeCompare(x.em));
  return ok(lotes, { requestId: a.requestId });
}
