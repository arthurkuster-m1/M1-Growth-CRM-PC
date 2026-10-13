import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET /api/v1/leads/[id]/origem — de onde o lead veio (campanha, criativo, landing page, origem
 * em texto) + os campos e as tags, e as opções para trocar.
 * PUT /api/v1/leads/[id]/origem — corrige a origem do lead (atendente em diante).
 *
 * A origem é o que o CRM mede: leads por campanha, CPL por criativo e por LP, origem da venda.
 * Corrigir aqui corrige essas contas.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { camposDoFunil, settingsDoEmbed } from "@/lib/leads/campos-do-funil";
import { origemDoContato } from "@/lib/leads/origem-do-contato";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { nomesDosAtendentes } from "@/lib/users/nome-do-atendente";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

const idSchema = z.string().uuid();

function nomeDoEmbed(embed: unknown): string | null {
  const um = Array.isArray(embed) ? embed[0] : embed;
  const nome = (um as { name?: unknown } | null | undefined)?.name;
  return typeof nome === "string" ? nome : null;
}

const corpoSchema = z.object({
  campaign_id: z.string().uuid().nullable().optional(),
  creative_id: z.string().uuid().nullable().optional(),
  landing_page_id: z.string().uuid().nullable().optional(),
  source: z.string().trim().min(1).max(80).optional(),
  /** O conjunto de anúncios e o posicionamento (nomes) — moram na origem do próprio card. */
  conjunto: z.string().trim().max(200).nullable().optional(),
  posicionamento: z.string().trim().max(80).nullable().optional(),
});

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Lead não encontrado."), 404, { requestId });

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const { data: lead, error } = await supabase
    .from("crm_leads")
    .select(
      "id, contact_id, stage_id, source, source_metadata, external_id, owner_user_id, owner_kind, lost_reason, created_at, updated_at, assigned_at, last_activity_at, stage_changed_at, closed_at, tags, custom_fields, title, description, value_cents, currency, expected_close_date, status, pipeline_id, demand_campaign_id, demand_creative_id, demand_landing_page_id, crm_pipelines(name, settings), crm_stages!crm_leads_stage_id_fkey(name)",
    )
    .eq("id", id.data)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao carregar o lead."), 500, { requestId });
  if (!lead) return fail("not_found", t("Lead não encontrado."), 404, { requestId });

  const { data: etapasDoFunil } = await supabase
    .from("crm_stages")
    .select("id, name, position, is_won, is_lost, is_archived")
    .eq("organization_id", orgId)
    .eq("pipeline_id", (lead as { pipeline_id: string }).pipeline_id)
    .order("position", { ascending: true });

  const [campanhas, criativos, paginas] = await Promise.all([
    supabase
      .from("demand_campaigns")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("position", { ascending: true })
      .limit(500),
    supabase
      .from("demand_campaign_creatives")
      .select("id, name, campaign_id")
      .eq("organization_id", orgId)
      .limit(2000),
    supabase
      .from("demand_campaign_landing_pages")
      .select("id, name, campaign_id")
      .eq("organization_id", orgId)
      .limit(2000),
  ]);
  const doTipo = (linhas: unknown) =>
    (linhas ?? []) as Array<{ id: string; name: string; campaign_id: string }>;
  const cri = doTipo(criativos.data);
  const lps = doTipo(paginas.data);

  const l = lead as {
    id: string;
    contact_id: string | null;
    stage_id: string | null;
    source: string | null;
    tags: string[] | null;
    custom_fields: Record<string, unknown> | null;
    demand_campaign_id: string | null;
    demand_creative_id: string | null;
    demand_landing_page_id: string | null;
    source_metadata: Record<string, unknown> | null;
    external_id: string | null;
    owner_user_id: string | null;
    owner_kind: string | null;
    lost_reason: string | null;
    created_at: string;
    updated_at: string;
    assigned_at: string | null;
    last_activity_at: string | null;
    stage_changed_at: string | null;
    closed_at: string | null;
    title: string;
    description: string | null;
    value_cents: number | null;
    currency: string | null;
    expected_close_date: string | null;
    status: string;
    pipeline_id: string;
    crm_pipelines: unknown;
    crm_stages: unknown;
  };
  const nomeDoDono = l.owner_user_id
    ? ((await nomesDosAtendentes([l.owner_user_id])).get(l.owner_user_id) ?? null)
    : null;
  return ok(
    {
      lead_id: l.id,
      sistema: {
        criado_em: l.created_at,
        atualizado_em: l.updated_at,
        entrou_na_etapa_em: l.stage_changed_at,
        ultima_atividade_em: l.last_activity_at,
        atribuido_em: l.assigned_at,
        fechado_em: l.closed_at,
        motivo_da_perda: l.lost_reason,
        responsavel: nomeDoDono,
        dono_id: l.owner_user_id,
        responsavel_tipo: l.owner_kind,
        id_externo: l.external_id,
      },
      rastreamento: l.source_metadata ?? {},
      negocio: {
        id: l.id,
        title: l.title,
        description: l.description,
        value_cents: l.value_cents,
        currency: l.currency,
        expected_close_date: l.expected_close_date,
        status: l.status,
        pipeline_id: l.pipeline_id,
        funil_nome: nomeDoEmbed(l.crm_pipelines),
        etapa_nome: nomeDoEmbed(l.crm_stages),
        etapa_id: l.stage_id,
        etapas: (
          (etapasDoFunil ?? []) as Array<{
            id: string;
            name: string;
            is_won: boolean;
            is_lost: boolean;
            is_archived: boolean;
          }>
        )
          .filter((e) => !e.is_archived)
          .map((e) => ({ id: e.id, nome: e.name, ganho: e.is_won, perdido: e.is_lost })),
        field_defs: camposDoFunil(settingsDoEmbed(l.crm_pipelines)),
      },
      contact_id: l.contact_id,
      source: l.source,
      tags: l.tags ?? [],
      custom_fields: l.custom_fields ?? {},
      campaign_id: l.demand_campaign_id,
      creative_id: l.demand_creative_id,
      landing_page_id: l.demand_landing_page_id,
      conjunto: origemDoContato(l.source_metadata, l.source ?? "").conjunto,
      posicionamento: origemDoContato(l.source_metadata, l.source ?? "").posicionamento,
      campanhas: ((campanhas.data ?? []) as Array<{ id: string; name: string }>).map((c) => ({
        id: c.id,
        nome: c.name,
        criativos: cri
          .filter((x) => x.campaign_id === c.id)
          .map((x) => ({ id: x.id, nome: x.name })),
        landing_pages: lps
          .filter((x) => x.campaign_id === c.id)
          .map((x) => ({ id: x.id, nome: x.name })),
      })),
    },
    { requestId },
  );
}

export async function PUT(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Lead não encontrado."), 404, { requestId });
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  const { campaign_id, creative_id, landing_page_id, source, conjunto, posicionamento } = corpo.data;

  const patch: Record<string, unknown> = {};
  if (campaign_id !== undefined) {
    patch.demand_campaign_id = campaign_id;
    if (campaign_id === null) {
      // Sem campanha, criativo e LP não fazem sentido: saem junto.
      patch.demand_creative_id = null;
      patch.demand_landing_page_id = null;
    } else {
      const { data: c } = await supabase
        .from("demand_campaigns")
        .select("id")
        .eq("id", campaign_id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!c) return fail("validation_failed", t("Campanha não encontrada."), 422, { requestId });
    }
  }
  const campanhaAlvo = campaign_id ?? null;
  for (const [campo, valor, tabela] of [
    ["demand_creative_id", creative_id, "demand_campaign_creatives"],
    ["demand_landing_page_id", landing_page_id, "demand_campaign_landing_pages"],
  ] as const) {
    if (valor === undefined) {
      // Trocou de campanha sem escolher de novo: o antigo não vale para a campanha nova.
      if (campaign_id !== undefined) patch[campo] = null;
      continue;
    }
    if (valor === null) {
      patch[campo] = null;
      continue;
    }
    const { data: item } = await supabase
      .from(tabela)
      .select("id, campaign_id")
      .eq("id", valor)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!item || (campanhaAlvo && (item as { campaign_id: string }).campaign_id !== campanhaAlvo)) {
      return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
    }
    patch[campo] = valor;
    if (campaign_id === undefined) {
      patch.demand_campaign_id = (item as { campaign_id: string }).campaign_id;
    }
  }
  if (source !== undefined) patch.source = source;
  if (conjunto !== undefined || posicionamento !== undefined) {
    // Conjunto e posicionamento são texto do próprio card (`origem_manual`); o rastreamento
    // original (UTMs) continua intacto.
    const { data: atual } = await supabase
      .from("crm_leads")
      .select("source_metadata")
      .eq("id", id.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    const meta = ((atual as { source_metadata: Record<string, unknown> | null } | null)
      ?.source_metadata ?? {}) as Record<string, unknown>;
    const manual = {
      ...((meta.origem_manual as Record<string, unknown> | undefined) ?? {}),
    };
    if (conjunto !== undefined) manual.conjunto = conjunto ?? "";
    if (posicionamento !== undefined) manual.posicionamento = posicionamento ?? "";
    patch.source_metadata = { ...meta, origem_manual: manual };
  }
  if (Object.keys(patch).length === 0) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }

  const { data, error } = await supabase
    .from("crm_leads")
    .update(patch)
    .eq("id", id.data)
    .eq("organization_id", orgId)
    .select("id, source, demand_campaign_id, demand_creative_id, demand_landing_page_id")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao salvar."), 500, { requestId });
  if (!data) return fail("not_found", t("Lead não encontrado."), 404, { requestId });

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "lead.origem_changed",
    resourceType: "lead",
    resourceId: id.data,
    requestId,
    metadata: patch,
  });
  return ok(data, { requestId });
}
