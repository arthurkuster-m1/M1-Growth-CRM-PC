import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { TelaDaAutomacao, type RegraDaTela } from "./_components/TelaDaAutomacao";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automação" };

const COLUNAS =
  "id, name, trigger_event, conditions, actions, trigger_config, is_active, run_count";

/** A automação aberta como DIAGRAMA (Fase 1 do motor único: só leitura). Gerente em diante. */
export default async function AutomacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_rules")
    .select(COLUNAS)
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (!data) notFound();

  return <TelaDaAutomacao regra={data as unknown as RegraDaTela} />;
}
