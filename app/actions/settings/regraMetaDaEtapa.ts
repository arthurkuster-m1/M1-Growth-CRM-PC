"use server";

/**
 * O evento da Meta CAPI de UMA etapa, lido e gravado de dentro do Funil de conversão da campanha.
 *
 * Difere de `salvarRegrasDeConversaoMeta` (a lista INTEIRA, de Conexões › Meta Ads, que desliga o
 * que sumir da lista): aqui só a regra da etapa pedida muda — as outras etapas nunca são tocadas.
 * Mesma porta: administrador da empresa, segundo fator em dia, fora do modo suporte.
 */
import { headers } from "next/headers";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida, resolveActiveOrg } from "@/lib/auth/server";
import { podeAdministrarEmpresa } from "@/lib/auth/pode-administrar-empresa";
import { lerEstadoDaConexao } from "@/lib/conversoes/estado-da-conexao";
import {
  EVENTOS_DA_META,
  eventoDaEtapaMeta,
  listarRegrasMeta,
  PADRAO_DE_EVENTO_PERSONALIZADO,
} from "@/lib/conversoes/regras-meta";
import { supportWriteError } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RegraMetaDaEtapa {
  stageId: string;
  enabled: boolean;
  metaEvent: string;
}

export type LeituraDasRegrasMeta =
  | {
      ok: true;
      regras: RegraMetaDaEtapa[];
      /** Os eventos personalizados que a empresa já criou (em qualquer etapa). */
      personalizados: string[];
      /** A conexão com a Meta CAPI (dataset e token) já foi feita. */
      conectada: boolean;
      /** A conexão está ligada (não pausada). */
      ligada: boolean;
      podeEditar: boolean;
    }
  | { ok: false; error: "unauthenticated" | "forbidden_tenant" | "erro_ao_ler" };

const idSchema = z.uuid();

export async function lerRegrasMetaDoFunil(pipelineId: string): Promise<LeituraDasRegrasMeta> {
  if (!idSchema.safeParse(pipelineId).success) return { ok: false, error: "erro_ao_ler" };
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  const admin = createAdminClient();
  const orgId = activeOrg.orgId;
  try {
    const [etapas, regras, estado] = await Promise.all([
      admin
        .from("crm_stages")
        .select("id")
        .eq("organization_id", orgId)
        .eq("pipeline_id", pipelineId),
      listarRegrasMeta(admin, orgId),
      lerEstadoDaConexao(admin, orgId),
    ]);
    if (etapas.error) return { ok: false, error: "erro_ao_ler" };
    const doFunil = new Set(((etapas.data ?? []) as Array<{ id: string }>).map((e) => e.id));
    const padrao = new Set<string>(EVENTOS_DA_META.map((e) => e.valor));
    return {
      ok: true,
      regras: regras
        .filter((r) => doFunil.has(r.stageId))
        .map((r) => ({ stageId: r.stageId, enabled: r.enabled, metaEvent: r.metaEvent })),
      personalizados: [
        ...new Set(regras.map((r) => r.metaEvent).filter((e) => !padrao.has(e))),
      ].sort(),
      conectada: estado.conectada,
      ligada: estado.habilitada,
      podeEditar: podeAdministrarEmpresa(authUser, activeOrg),
    };
  } catch {
    return { ok: false, error: "erro_ao_ler" };
  }
}

const entradaSchema = z.object({
  stage_id: z.uuid(),
  enabled: z.boolean(),
  meta_event: z.string().regex(PADRAO_DE_EVENTO_PERSONALIZADO),
});

export type SalvarRegraMetaDaEtapa =
  | { ok: true }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "unauthenticated"
        | "forbidden_tenant"
        | "forbidden_role"
        | "mfa_required"
        | "etapa_invalida"
        | "erro_ao_gravar";
    };

export async function salvarRegraMetaDaEtapa(
  input: z.input<typeof entradaSchema>,
): Promise<SalvarRegraMetaDaEtapa> {
  const parsed = entradaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_failed" };
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  if (supportWriteError(authUser.support)) return { ok: false, error: "forbidden_role" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!podeAdministrarEmpresa(authUser, activeOrg)) return { ok: false, error: "forbidden_role" };
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };

  const admin = createAdminClient();
  const orgId = activeOrg.orgId;
  const { stage_id, enabled, meta_event } = parsed.data;

  // Só etapa ABERTA desta empresa: ganho é a compra (outro consumidor) e perda não é conversão.
  const { data: etapa, error: erroEtapa } = await admin
    .from("crm_stages")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", stage_id)
    .eq("is_won", false)
    .eq("is_lost", false)
    .maybeSingle();
  if (erroEtapa) return { ok: false, error: "erro_ao_gravar" };
  if (!etapa) return { ok: false, error: "etapa_invalida" };

  const { error } = await admin.from("meta_ads_conversion_rules").upsert(
    {
      organization_id: orgId,
      stage_id,
      event_name: eventoDaEtapaMeta(stage_id),
      meta_event,
      enabled,
      updated_by: authUser.id,
    },
    { onConflict: "organization_id,stage_id" },
  );
  if (error) return { ok: false, error: "erro_ao_gravar" };

  const hdrs = await headers();
  await audit({
    action: "meta_ads_conversion_rules.updated",
    actorUserId: authUser.id,
    organizationId: orgId,
    resourceType: "meta_ads_conversion_rules",
    resourceId: null,
    requestId: hdrs.get("x-request-id") ?? undefined,
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: hdrs.get("user-agent") ?? undefined,
    metadata: { stage_id, enabled, meta_event },
  });
  return { ok: true };
}
