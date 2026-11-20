import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { FinancasCasca } from "@/components/financas/FinancasCasca";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/**
 * FINANÇAS — o controle financeiro da empresa, no modelo do app de Finanças da Família Kuster
 * (docs/PLANO-FINANCAS-M1.md). Só gerente ou acima vê e lança (decisão do Arthur); a RLS das tabelas
 * `fin_*` e o piso das rotas `/api/v1/financas/*` repetem a regra. As entradas vêm das VENDAS
 * (Oportunidades › Vendas) sozinhas; as saídas são lançadas aqui.
 */
export default async function FinancasLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const plataforma = user.is_platform_admin && !user.support;
  if (!plataforma && ROLE_RANK[org.role] < ROLE_RANK.manager) redirect("/app");

  return <FinancasCasca>{children}</FinancasCasca>;
}
