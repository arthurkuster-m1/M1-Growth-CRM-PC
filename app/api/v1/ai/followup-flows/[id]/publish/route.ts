import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/ai/followup-flows/:id/publish — valida o draft_graph
 * (validateFlowForPublish, Task 2.2) e, se válido, publica atomicamente via
 * fn_publish_followup_flow_version (migration 0056): insert da version +
 * ativação do pointer (active_version_id + status='active') numa função só,
 * sem janela onde a version fica órfã. EXECUTE da função é só service_role
 * (revogado de authenticated) — por isso o client aqui é o admin, com
 * organization_id sempre filtrado explicitamente (nunca do body).
 *
 * 422 validation_failed com details.errors (mesmo shape de PublishValidationError)
 * se draft_graph ausente ou reprovado na validação estrutural/semântica.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregaEtapasCitadas } from "@/lib/followup/etapas-citadas";
import { triggerConfigSchema, type FollowupFlowSurface } from "@/lib/followup/api-schemas";
import { configDoGatilhoEstaCompleta } from "@/lib/followup/config-do-gatilho";
import { moduloLigado } from "@/lib/instalacao/modulos";
import {
  algumCanalExigeModeloForaDaJanela,
  proximosDoGrafo,
  validateFlowForPublish,
  type RoteiroDoPublish,
} from "@/lib/followup/validate-publish";
import { publishFollowupFlowVersion } from "@/lib/followup/publish";
import type { FlowGraph } from "@/lib/followup/graph-schema";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

/** O evento do gatilho `event` (automação de CRM), ou `undefined` em qualquer outro gatilho. */
function eventoDoGatilho(triggerConfig: unknown): string | undefined {
  const lido = triggerConfigSchema.safeParse(triggerConfig);
  return lido.success && lido.data.kind === "event" ? lido.data.params.event_type : undefined;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!UUID_RX.test(id)) {
    return fail("invalid_request", "id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "followup_flows" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  const admin = createAdminClient();
  const { data: pointer, error: fetchErr } = await admin
    .from("followup_flow_pointers")
    .select("id, draft_graph, trigger_config, surface")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (fetchErr) return fail("internal_error", fetchErr.message, 500, { requestId });
  if (!pointer) return fail("not_found", t("Fluxo não encontrado."), 404, { requestId });

  // Roteiro de atendimento: só existe com o módulo ligado (mesma resposta de
  // quem não tem a porta), e só começa por palavra-gatilho ou roteador — nunca
  // pelo relógio. Gatilho de relógio num roteiro criaria enrollment que o banco
  // recusa (`trg_enrollment_superficie_coerente`, 0394); a recusa é AQUI, com
  // uma pessoa na tela para corrigir.
  const surface = (pointer.surface ?? "followup") as FollowupFlowSurface;
  if (surface === "atendimento") {
    if (!(await moduloLigado(admin, "fluxos_atendimento"))) {
      return fail("not_found", t("Fluxo não encontrado."), 404, { requestId });
    }
    const kind = (pointer.trigger_config as { kind?: string } | null)?.kind ?? "manual";
    if (kind !== "manual") {
      return fail(
        "trigger_kind_not_implemented",
        t("Roteiro de atendimento começa por palavra-gatilho ou pelo roteador, não por gatilho de follow-up."),
        422,
        { requestId },
      );
    }
  }

  // ⚠️ ALLOWLIST, NÃO DENYLIST — e a diferença não é estilo.
  //
  // A versão anterior recusava UM literal (`conversation_end`) e deixava passar
  // qualquer outro. Só que `trigger_config` é `jsonb` SEM CHECK, e este publish
  // lê a linha CRUA do banco — não passa pelo Zod do PATCH. Então uma linha
  // escrita por SQL à mão, por um clone open-source, ou por uma versão futura do
  // produto, publicava `status='active'` e nunca enrollava ninguém: fluxo morto
  // com cara de vivo, que é o desfecho exato que este bloco existe para impedir.
  //
  // Kind entra neste conjunto só DEPOIS de ter motor de enrollment vivo:
  // `manual`/`webhook` (POST enroll + ação de regra), `silence` (silence-sweep),
  // `stage_change` (gatilho-etapa), `case_opened` (gatilho-caso),
  // `appointment_no_show` (followup-gatilho-presenca.v1, confirmação humana),
  // `inbound_after_silence` (gatilho-retorno, cliente que voltou) e
  // `lead_created` (gatilho-lead, negócio que acabou de nascer) e
  // `event` (gatilho-evento, automação de CRM — só na superfície `crm_automation`).
  const KINDS_COM_MOTOR = new Set(["manual", "webhook", "silence", "stage_change", "case_opened", "appointment_no_show", "inbound_after_silence", "lead_created", "event"]);
  const trigger = (pointer.trigger_config ?? { kind: "manual" }) as {
    kind?: string;
    params?: { stage_id?: string };
  };
  const triggerKind = trigger.kind ?? "manual";
  if (!KINDS_COM_MOTOR.has(triggerKind)) {
    return fail(
      "trigger_kind_not_implemented",
      `O gatilho «${triggerKind}» não está disponível — use Etapa do funil, Silêncio ou Manual.`,
      422,
      { requestId },
    );
  }

  // Automação de CRM só começa por evento: manual/silêncio/etapa... são gatilhos do follow-up, que o motor
  // de automação não consome — publicar assim seria fluxo ativo que nunca dispara.
  if (surface === "crm_automation" && triggerKind !== "event") {
    return fail(
      "trigger_event_obrigatorio",
      t("Escolha o que dispara esta automação antes de publicar."),
      422,
      { requestId },
    );
  }

  // Gatilho por EVENTO é o gatilho das automações de CRM: o motor que o consome só olha pointers
  // `crm_automation`, então publicar `event` em outra superfície seria fluxo morto com cara de vivo.
  // E o jsonb não passa pelo Zod do PATCH — o evento e as condições são lidos aqui, pela mesma tupla
  // que o handler usa, para o fluxo não nascer ativo e nunca disparar.
  if (triggerKind === "event") {
    if (surface !== "crm_automation") {
      return fail(
        "trigger_event_so_em_automacao",
        t("O gatilho «acontecer algo no CRM» só existe nas automações do CRM."),
        422,
        { requestId },
      );
    }
    const lido = triggerConfigSchema.safeParse(pointer.trigger_config);
    if (!lido.success) {
      return fail(
        "trigger_event_invalido",
        t("Escolha o que dispara esta automação antes de publicar."),
        422,
        { requestId },
      );
    }
    // Os gatilhos por tempo e por data precisam dos parâmetros que o relógio lê (dias, direção, funil...):
    // sem eles o fluxo publica "ativo" e o relógio nunca o dispara. A mesma conferência que a rota das regras faz.
    if (lido.data.kind === "event" && !configDoGatilhoEstaCompleta(lido.data.params)) {
      return fail(
        "trigger_event_config_invalida",
        t("Complete o tempo (ou a data) que dispara esta automação antes de publicar."),
        422,
        { requestId },
      );
    }
  }

  // ⚠️ ETAPA QUE NÃO EXISTE MAIS É FLUXO MORTO COM CARA DE VIVO. O gatilho casa
  // o `to_stage_id` do evento com este `stage_id`: apontando para etapa apagada,
  // arquivada ou de outra org, o pointer fica `active` e nunca enrolla ninguém —
  // exatamente o desfecho que o bloqueio acima existe para evitar. A recusa é
  // aqui, no momento em que há um humano na tela para corrigir.
  if (triggerKind === "stage_change") {
    const stageId = trigger.params?.stage_id;
    if (!stageId || !UUID_RX.test(stageId)) {
      return fail(
        "trigger_stage_missing",
        t("Escolha a etapa do funil que dispara este fluxo antes de publicar."),
        422,
        { requestId },
      );
    }
    const { data: stage, error: stageErr } = await admin
      .from("crm_stages")
      .select("id, name, is_archived")
      .eq("id", stageId)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (stageErr) return fail("internal_error", stageErr.message, 500, { requestId });
    if (!stage) {
      return fail(
        "trigger_stage_not_found",
        t("A etapa escolhida para o gatilho não existe mais neste funil — escolha outra."),
        422,
        { requestId },
      );
    }
    if (stage.is_archived) {
      return fail(
        "trigger_stage_archived",
        `A etapa «${stage.name}» está arquivada e nunca receberia um negócio — escolha uma etapa ativa.`,
        422,
        { requestId },
      );
    }
  }

  if (!pointer.draft_graph) {
    return fail("validation_failed", t("Fluxo não tem rascunho pronto para publicar."), 422, {
      requestId,
      details: {
        errors: [
          {
            node_id: null,
            code: "no_trigger",
            message: t("draft_graph ausente — monte o fluxo antes de publicar."),
          },
        ],
      },
    });
  }

  const graph = pointer.draft_graph as unknown as FlowGraph;
  // A regra de etapa guarda o `stage_id`, e só o banco diz se a etapa existe e
  // está ativa — sem esta leitura, uma regra que nunca decide publicaria calada.
  const citadas = await carregaEtapasCitadas(admin, activeOrg.orgId, graph.nodes);
  if (!citadas.ok) return fail("internal_error", citadas.mensagem, 500, { requestId });
  // Roteiro: para onde os OUTROS roteiros ativos encadeiam — para recusar a
  // publicação que fecharia um ciclo A → B → A (revisão do #1573).
  let roteiro: RoteiroDoPublish | undefined;
  if (surface === "atendimento") {
    const { data: ativos, error: ativosErr } = await admin
      .from("followup_flow_pointers")
      .select("id, name, active_version_id")
      .eq("organization_id", activeOrg.orgId)
      .eq("surface", "atendimento")
      .eq("status", "active")
      .neq("id", id);
    if (ativosErr) return fail("internal_error", ativosErr.message, 500, { requestId });
    const versoes = (ativos ?? []).flatMap((r) => (r.active_version_id ? [r.active_version_id as string] : []));
    const grafos = new Map<string, unknown>();
    if (versoes.length > 0) {
      const { data: vs, error: vsErr } = await admin
        .from("followup_flow_versions")
        .select("id, graph")
        .eq("organization_id", activeOrg.orgId)
        .in("id", versoes);
      if (vsErr) return fail("internal_error", vsErr.message, 500, { requestId });
      for (const v of vs ?? []) grafos.set(v.id as string, v.graph);
    }
    roteiro = {
      pointerId: id,
      encadeamentos: new Map(
        (ativos ?? []).map((r) => [
          r.id as string,
          { nome: r.name as string, proximos: proximosDoGrafo(grafos.get(r.active_version_id as string)) },
        ]),
      ),
    };
  }
  // O plano B da mensagem por IA só existe para canal com janela de 24 h. Uma
  // organização só com canal sem janela não tem modelo aprovado para escolher,
  // e exigir o plano B dela travaria o publish (revisão do #1729).
  const { data: conexoes, error: conexoesErr } = await admin
    .from("channel_sessions")
    .select("provider")
    .eq("organization_id", activeOrg.orgId)
    .is("archived_at", null);
  if (conexoesErr) return fail("internal_error", conexoesErr.message, 500, { requestId });
  const exigeModeloForaDaJanela = algumCanalExigeModeloForaDaJanela(
    (conexoes ?? []).map((c) => c.provider as string | null),
  );
  const validation = validateFlowForPublish(graph, {
    etapas: citadas.etapas,
    surface,
    roteiro,
    exigeModeloForaDaJanela,
    eventoDoGatilho: eventoDoGatilho(pointer.trigger_config),
  });
  if (!validation.ok) {
    return fail("validation_failed", t("Fluxo reprovado na validação de publish."), 422, {
      requestId,
      details: { errors: validation.errors },
    });
  }

  const result = await publishFollowupFlowVersion(admin, {
    orgId: activeOrg.orgId,
    pointerId: id,
    graph,
    createdBy: user.id,
  });
  if (!result.ok) {
    if (result.code === "pointer_not_found") {
      return fail("not_found", t("Fluxo não encontrado."), 404, { requestId });
    }
    return fail("internal_error", result.message, 500, { requestId });
  }

  const { data: updatedPointer, error: reloadErr } = await admin
    .from("followup_flow_pointers")
    .select("id, status, active_version_id, updated_at")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .single();
  if (reloadErr || !updatedPointer) {
    return fail("internal_error", reloadErr?.message ?? "followup_flow_reload_failed", 500, {
      requestId,
    });
  }

  void audit({
    action: "followup_flow.published",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "followup_flow_pointer",
    resourceId: id,
    requestId,
    metadata: { version_id: result.version_id },
  });

  return ok(updatedPointer, { requestId });
}
