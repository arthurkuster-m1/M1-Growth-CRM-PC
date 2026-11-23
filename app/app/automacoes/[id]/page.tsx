import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FlowBuilder } from "@/app/app/ai/followups/[id]/_components/FlowBuilder";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import type { FollowupFlowDetailRow } from "@/hooks/followup/useFollowupFlow";
import { rascunhoDoFluxo } from "@/lib/followup/rascunho";
import { createClient } from "@/lib/supabase/server";
import { TelaDaAutomacao, type RegraDaTela } from "./_components/TelaDaAutomacao";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automação" };

const COLUNAS_DA_REGRA =
  "id, name, trigger_event, conditions, actions, trigger_config, is_active, run_count";
const COLUNAS_DO_FLUXO =
  "id, name, status, active_version_id, draft_graph, handoff_policy, trigger_config, surface, created_at, updated_at";

/**
 * Abre uma automação. Duas origens, o mesmo endereço:
 *  - um FLUXO de automação de CRM (motor único): o editor de diagrama, com gatilho, condições e passos;
 *  - uma REGRA antiga (ainda não migrada): o diagrama só de leitura.
 * Gerente em diante.
 */
export default async function AutomacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();

  const { data: fluxo } = await supabase
    .from("followup_flow_pointers")
    .select(COLUNAS_DO_FLUXO)
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .eq("surface", "crm_automation")
    .maybeSingle();

  if (fluxo) {
    const { data: versoes } = await supabase
      .from("followup_flow_versions")
      .select("id, created_at")
      .eq("organization_id", activeOrg.orgId)
      .eq("pointer_id", id)
      .order("created_at", { ascending: false });

    const draft_graph = await rascunhoDoFluxo(
      supabase,
      fluxo as unknown as { draft_graph: unknown; active_version_id: string | null },
      activeOrg.orgId,
    );
    const flow: FollowupFlowDetailRow = {
      ...(fluxo as unknown as Omit<
        FollowupFlowDetailRow,
        "versions_count" | "previous_version_id"
      >),
      draft_graph,
      versions_count: versoes?.length ?? 0,
      previous_version_id: versoes?.[1]?.id ?? null,
    };
    return (
      <div className="flex h-full flex-col">
        <FlowBuilder flowId={id} initialData={flow} />
      </div>
    );
  }

  const { data: regra } = await supabase
    .from("automation_rules")
    .select(COLUNAS_DA_REGRA)
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (!regra) notFound();

  return <TelaDaAutomacao regra={regra as unknown as RegraDaTela} />;
}
