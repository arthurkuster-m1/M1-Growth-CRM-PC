/**
 * POST /api/v1/demand-campaigns/[id]/importacao — importa uma planilha de leads DENTRO da campanha
 * (manager+). Mesma planilha, mesma regra de `POST /api/v1/leads/import`; a diferença é o destino
 * (o funil da campanha) e a origem: cada lead nasce ligado à campanha e com o arquivo gravado.
 *
 * Duas etapas, no mesmo endereço:
 *  - sem `confirmar`: só a PRÉVIA — quantas linhas são novas, repetidas, já estão no CRM ou são
 *    inválidas. Nada é gravado;
 *  - com `confirmar=1`: importa e registra o lote (`demand_lead_imports`).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { CSV_MAX_BYTES, CSV_MAX_DATA_ROWS, decodificarCsv } from "@/lib/contacts/csv";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { importarLinhasDeLeads } from "@/lib/leads/importar-planilha";
import { lerPlanilhaDeLeads, type LinhaDeLead } from "@/lib/leads/planilha";
import {
  chaveDeEmail,
  chaveDeTelefone,
  previaDaImportacao,
} from "@/lib/leads/previa-da-importacao";
import { autorizarCampanhas, campanhaNaoEncontrada } from "@/lib/marketing/campanhas-servidor";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const LOTE = 100;

/** Quais pessoas da planilha já são contatos da empresa (por telefone ou e-mail). */
async function pessoasJaNoCrm(
  supabase: Awaited<ReturnType<typeof autorizarCampanhas>> extends infer R
    ? R extends { supabase: infer S }
      ? S
      : never
    : never,
  orgId: string,
  leads: readonly LinhaDeLead[],
): Promise<Set<string>> {
  const achadas = new Set<string>();
  const telefones = [...new Set(leads.flatMap((l) => (l.telefone ? [l.telefone] : [])))];
  for (let i = 0; i < telefones.length; i += LOTE) {
    const fatia = telefones.slice(i, i + LOTE);
    const variantes = fatia.flatMap((t) => phoneLookupVariants(t));
    const { data } = await supabase
      .from("contacts")
      .select("phone_number")
      .eq("organization_id", orgId)
      .in("phone_number", variantes)
      .limit(variantes.length);
    const existentes = new Set(
      ((data ?? []) as Array<{ phone_number: string | null }>).flatMap((r) =>
        r.phone_number ? [r.phone_number] : [],
      ),
    );
    for (const t of fatia) {
      if (phoneLookupVariants(t).some((v) => existentes.has(v))) achadas.add(chaveDeTelefone(t));
    }
  }
  const emails = [
    ...new Set(
      leads.flatMap((l) => (!l.telefone && l.email ? [l.email.trim().toLowerCase()] : [])),
    ),
  ];
  for (let i = 0; i < emails.length; i += LOTE) {
    const fatia = emails.slice(i, i + LOTE);
    const { data } = await supabase
      .from("contacts")
      .select("email_normalized")
      .eq("organization_id", orgId)
      .in("email_normalized", fatia)
      .is("is_merged_into", null)
      .limit(fatia.length);
    for (const r of (data ?? []) as Array<{ email_normalized: string | null }>) {
      if (r.email_normalized) achadas.add(chaveDeEmail(r.email_normalized));
    }
  }
  return achadas;
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarCampanhas("manager", true);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return campanhaNaoEncontrada(a.t, a.requestId);
  const { t, requestId, orgId, supabase } = a;

  const { data: campanha } = await supabase
    .from("demand_campaigns")
    .select("id, name, pipeline_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!campanha) return campanhaNaoEncontrada(t, requestId);
  const pipelineId = (campanha as { pipeline_id: string | null }).pipeline_id;
  if (!pipelineId) {
    return fail(
      "validation_failed",
      t("Crie o funil da campanha antes de importar leads nela."),
      422,
      { requestId },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("validation_failed", t("Envie o arquivo como multipart/form-data."), 422, {
      requestId,
    });
  }
  const arquivo = form.get("file");
  const pareceArquivo =
    typeof arquivo === "object" &&
    arquivo !== null &&
    typeof (arquivo as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
    typeof (arquivo as { size?: unknown }).size === "number";
  if (!pareceArquivo) {
    return fail("validation_failed", t("Envie o arquivo no campo 'file'."), 422, { requestId });
  }
  const enviado = arquivo as unknown as File;
  if (enviado.size > CSV_MAX_BYTES) {
    return fail(
      "validation_failed",
      t("Arquivo maior que ") + `${Math.floor(CSV_MAX_BYTES / 1024 / 1024)}MB.`,
      413,
      { requestId },
    );
  }
  const decodificado = decodificarCsv(await enviado.arrayBuffer());
  if ("erro" in decodificado) {
    return fail("validation_failed", t(decodificado.erro), 422, { requestId });
  }

  const { data: funilRow } = await supabase
    .from("crm_pipelines")
    .select("id, settings")
    .eq("id", pipelineId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!funilRow) return fail("not_found", t("Funil não encontrado."), 404, { requestId });
  const camposDefinidos = camposDoFunil(
    (funilRow as { settings: Record<string, unknown> | null }).settings,
  );

  const lido = lerPlanilhaDeLeads(decodificado.texto, t, camposDefinidos);
  if ("erro" in lido) return fail("validation_failed", lido.erro, 422, { requestId });
  if (lido.leads.length > CSV_MAX_DATA_ROWS) {
    return fail(
      "validation_failed",
      `${t("A planilha tem")} ${lido.leads.length} ${t("linhas; o limite é")} ${CSV_MAX_DATA_ROWS} ${t("por importação.")}`,
      422,
      { requestId },
    );
  }

  const jaNoCrm = await pessoasJaNoCrm(supabase, orgId, lido.leads);
  const previa = previaDaImportacao(lido, jaNoCrm);
  if (String(form.get("confirmar") ?? "") !== "1") {
    return ok({ previa }, { requestId });
  }

  // As etapas abertas do funil da campanha: a primeira é a de entrada, e a coluna "Etapa" da
  // planilha escolhe outra pelo nome.
  const { data: etapas } = await supabase
    .from("crm_stages")
    .select("id, name, is_won, is_lost, is_archived, position")
    .eq("pipeline_id", pipelineId)
    .eq("organization_id", orgId)
    .order("position", { ascending: true });
  const etapasAbertas = (
    (etapas ?? []) as Array<{
      id: string;
      name: string;
      is_won: boolean;
      is_lost: boolean;
      is_archived: boolean;
    }>
  ).filter((e) => !e.is_won && !e.is_lost && !e.is_archived);
  const entrada = etapasAbertas[0];
  if (!entrada) {
    return fail("validation_failed", t("Este funil não tem etapas abertas."), 422, { requestId });
  }

  const importacaoId = randomUUID();
  let resumo;
  try {
    resumo = await importarLinhasDeLeads(supabase, {
      orgId,
      userId: a.userId,
      requestId,
      pipelineId,
      stageId: entrada.id,
      etapasAbertas,
      lido,
      t,
      origem: {
        demandCampaignId: id,
        importacaoId,
        arquivo: (enviado.name || "planilha.csv").slice(0, 300),
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.code, err.message, err.status, { requestId });
    throw err;
  }

  // O registro do lote: é ele que aparece no histórico da campanha.
  const { error: erroDoRegistro } = await supabase.from("demand_lead_imports").insert({
    id: importacaoId,
    organization_id: orgId,
    demand_campaign_id: id,
    file_name: (enviado.name || "planilha.csv").slice(0, 300),
    total_rows: resumo.total_linhas,
    created_count: resumo.criados,
    existing_count: previa.ja_no_crm,
    invalid_count: resumo.erros.length,
    created_by: a.userId,
  });

  await audit({
    organizationId: orgId,
    actorUserId: a.userId,
    action: "lead.imported",
    resourceType: "demand_campaigns",
    resourceId: id,
    requestId,
    metadata: {
      pipeline_id: pipelineId,
      importacao_id: importacaoId,
      total_linhas: resumo.total_linhas,
      criados: resumo.criados,
      recusadas: resumo.erros.length,
    },
  });

  return ok({ resumo, importacao_id: importacaoId, registrada: !erroDoRegistro }, { requestId });
}
