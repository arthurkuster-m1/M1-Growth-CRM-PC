import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/leads/import — o funil a partir da planilha que a empresa já tem.
 * GET  /api/v1/leads/import — a planilha modelo, para quem não sabe por onde começar.
 *
 * Extraído do PR #418 (@clinicacentrodosorrisosc-code). A capacidade é dele; o
 * que muda é ONDE ela roda e com o quê — o racional está em
 * `lib/leads/planilha.ts`.
 *
 * ─── Desfecho POR LINHA, nunca do lote inteiro ─────────────────────────────
 *
 * Uma planilha de 400 nomes não pode morrer inteira pelo valor malformado da
 * linha 7. Linha inválida é pulada com o motivo nominal, que volta no response
 * e fica NA TELA — um toast que some em quatro segundos não serve para quem
 * precisa saber quais linhas corrigir.
 *
 * ─── Reusa `createLeadHandler`, e paga o preço disso ───────────────────────
 *
 * Cada linha passa pelo MESMO caminho de um negócio criado à mão: mesma
 * validação de etapa contra a organização, mesma `position_in_stage`, mesmo
 * `emit_event` e mesmo audit `lead.created`. Custa consultas a mais por linha, e
 * o teto de `CSV_MAX_DATA_ROWS` é o que torna o preço aceitável. A alternativa —
 * um insert em lote com a regra reescrita aqui — criaria a segunda verdade sobre
 * "como um negócio nasce", e é ela que envelhece sozinha.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/types";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { phoneLookupVariants } from "@/lib/channels/phone-variants";
import { CSV_MAX_BYTES, CSV_MAX_DATA_ROWS, decodificarCsv } from "@/lib/contacts/csv";
import { traduzir } from "@/lib/i18n/dicionario";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { importarLinhasDeLeads, type ResumoDaImportacao } from "@/lib/leads/importar-planilha";
import { lerLinhasDeLeads, lerPlanilhaDeLeads, type ErroDaLinha } from "@/lib/leads/planilha";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  // Mesma régua do POST unitário de lead: escrita é `agent` para cima.
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  // Duas portas, uma só regra de leitura: o ARQUIVO CSV (multipart) e a TABELA do popup do CRM
  // (JSON com as células já separadas). As duas viram `string[][]` e passam por `lerLinhasDeLeads`.
  const ehJson = (req.headers.get("content-type") ?? "").includes("application/json");
  let pipelineId = "";
  let stageId = "";
  let textoCsv: string | null = null;
  let celulas: string[][] | null = null;

  if (ehJson) {
    const corpo = z
      .object({
        pipeline_id: z.string().uuid(),
        stage_id: z.string().uuid().optional(),
        celulas: z
          .array(z.array(z.string().max(4000)).max(60))
          .min(1)
          .max(CSV_MAX_DATA_ROWS + 1),
      })
      .safeParse(await req.json().catch(() => null));
    if (!corpo.success) {
      return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
    }
    pipelineId = corpo.data.pipeline_id;
    stageId = corpo.data.stage_id ?? "";
    celulas = corpo.data.celulas;
  } else {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail("validation_failed", t("Envie o arquivo como multipart/form-data."), 422, {
        requestId,
      });
    }

    const arquivo = form.get("file");
    // ⚠️ POR FORMA, e não `instanceof File` (três realms: undici, jsdom, browser — o `instanceof`
    // é falso para um File legítimo vindo de outro). O que interessa é o que a rota vai FAZER
    // com o valor: ler os bytes e o tamanho.
    const pareceArquivo =
      typeof arquivo === "object" &&
      arquivo !== null &&
      typeof (arquivo as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
      typeof (arquivo as { size?: unknown }).size === "number";
    if (!pareceArquivo) {
      return fail("validation_failed", t("Envie o arquivo no campo 'file'."), 422, { requestId });
    }
    const enviado = arquivo as unknown as File;
    // O funil vem do FORM e é conferido contra a organização por `createLeadHandler` (404 para
    // etapa de outra org, 422 para etapa que não é do funil). `stage_id` é opcional: gente nova
    // entra na primeira etapa ABERTA do funil.
    pipelineId = String(form.get("pipeline_id") ?? "");
    stageId = String(form.get("stage_id") ?? "");
    if (!pipelineId) {
      return fail("validation_failed", t("Escolha o funil de destino."), 422, { requestId });
    }
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
    textoCsv = decodificado.texto;
  }

  const supabase = await createClient();

  // As etapas e os campos personalizados do funil: a planilha pode trazer a coluna "Etapa" (pelo
  // nome) e uma coluna por campo personalizado. Tudo conferido contra a ORGANIZAÇÃO ativa.
  const { data: funilRow } = await supabase
    .from("crm_pipelines")
    .select("id, settings")
    .eq("id", pipelineId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!funilRow) {
    return fail("not_found", t("Funil não encontrado."), 404, { requestId });
  }
  const camposDefinidos = camposDoFunil(
    (funilRow as { settings: Record<string, unknown> | null }).settings,
  );
  const { data: etapasDoFunil } = await supabase
    .from("crm_stages")
    .select("id, name, is_won, is_lost, is_archived, position")
    .eq("pipeline_id", pipelineId)
    .eq("organization_id", orgId)
    .order("position", { ascending: true });
  const etapasAbertas = (
    (etapasDoFunil ?? []) as Array<{
      id: string;
      name: string;
      is_won: boolean;
      is_lost: boolean;
      is_archived: boolean;
    }>
  ).filter((e) => !e.is_won && !e.is_lost && !e.is_archived);

  const lido =
    celulas !== null
      ? lerLinhasDeLeads(celulas, t, camposDefinidos)
      : lerPlanilhaDeLeads(textoCsv ?? "", t, camposDefinidos);
  if ("erro" in lido) {
    return fail("validation_failed", lido.erro, 422, { requestId });
  }
  if (lido.leads.length > CSV_MAX_DATA_ROWS) {
    return fail(
      "validation_failed",
      `${t("A planilha tem")} ${lido.leads.length} ${t("linhas; o limite é")} ${CSV_MAX_DATA_ROWS} ${t("por importação.")}`,
      422,
      { requestId },
    );
  }

  if (!stageId) {
    // Primeira etapa ABERTA do funil, por posição, dentro da organização ativa —
    // nunca confia em `pipeline_id` sozinho (poderia ser de outro tenant).
    //
    // ⚠️ `is_won`/`is_lost` fora, espelhando `funilDeEntrada` em
    // `lib/leads/nascimento-do-lead.ts` — que é a irmã canônica desta consulta e
    // carrega o racional: um lead não nasce fechado, e um funil mal ordenado não
    // pode fazer alguém entrar como "Perdido". Sem os dois filtros, um funil em
    // que "Pago" foi arrastado para a primeira coluna faz a planilha inteira
    // nascer como negócio JÁ GANHO (o trigger `fn_crm_lead_close_on_stage`
    // sobrescreve o `status: "open"` que o handler grava), e no caso simétrico de
    // perda o segundo trigger aborta cada linha com `lost_reason_required` — 200
    // na tela, zero leads criados.
    const { data: primeiraEtapa, error: erroEtapa } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .eq("is_won", false)
      .eq("is_lost", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (erroEtapa) {
      return fail("internal_error", erroEtapa.message, 500, { requestId });
    }
    if (!primeiraEtapa) {
      return fail("validation_failed", t("Este funil não tem etapas abertas."), 422, { requestId });
    }
    stageId = (primeiraEtapa as { id: string }).id;
  }

  let resumo: ResumoDaImportacao;
  try {
    resumo = await importarLinhasDeLeads(supabase, {
      orgId,
      userId: authz.user.id,
      requestId,
      pipelineId,
      stageId,
      etapasAbertas,
      lido,
      t,
    });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.code, err.message, err.status, { requestId });
    throw err;
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "lead.imported",
    resourceType: "crm_leads",
    requestId,
    metadata: {
      pipeline_id: pipelineId,
      stage_id: stageId,
      total_linhas: resumo.total_linhas,
      criados: resumo.criados,
      recusadas: resumo.erros.length,
    },
  });

  return ok(resumo, { requestId });
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;

  // ⚠️ VALOR E TAGS ENTRE ASPAS, e não é estilo: "12.500,00" tem uma vírgula
  // dentro, e o delimitador desta planilha É a vírgula. Sem as aspas o modelo
  // que a gente entrega seria lido errado pelo importador que a gente escreveu —
  // e a primeira coisa que a pessoa faz é mandar o modelo de volta.
  const modelo = [
    "nome,nome do contato,telefone,email,valor,origem,tags,observacao",
    'Reforma do apartamento 402,Ana Souza,11988887777,ana@exemplo.com,"12.500,00",indicacao,"quente;retorno",Pediu orcamento para junho',
    'Plano anual,Bruno Lima,(21) 97777-6666,,"1.200,00",site,,Veio pelo formulario',
  ].join("\n");

  return new Response(`﻿${modelo}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="modelo-leads.csv"',
      "x-request-id": requestId,
    },
  });
}
