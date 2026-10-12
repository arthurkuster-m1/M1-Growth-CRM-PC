import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { VendasCRM } from "@/components/vendas/VendasCRM";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendas" };

/** Vendas: o banco de todas as transações dos clientes (sessão 7 do plano do CRM). */
export default async function VendasPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const podeVer =
    (user.is_platform_admin && !user.support) || roleAtLeast(org.role, "agent");
  if (!podeVer) redirect("/app/clientes");
  return (
    <Suspense fallback={null}>
      <VendasCRM />
    </Suspense>
  );
}
