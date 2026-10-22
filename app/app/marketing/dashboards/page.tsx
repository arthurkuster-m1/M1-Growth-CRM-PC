import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardsClient } from "@/components/dashboards/DashboardsClient";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboards" };

/**
 * DASHBOARDS: Tráfego Pago, Prospecção Ativa (em breve), Comercial, Atendimento e Business. Fase D0:
 * protótipo visual com dados de exemplo (ver `docs/PLANO-DASHBOARDS-M1.md`).
 */
export default async function DashboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ painel?: string }>;
}) {
  const { painel } = await searchParams;
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  return <DashboardsClient empresa={org.name} painelInicial={painel} />;
}
