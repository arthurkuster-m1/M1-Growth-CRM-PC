import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";

import { FinancasCasca } from "./_casca";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finanças" };

/**
 * FINANÇAS — o controle financeiro da empresa, no modelo do app de Finanças da Família Kuster
 * (docs/PLANO-FINANCAS-M1.md): contas e cartões, lançamentos, visão do mês, do ano e geral, faturas.
 * As entradas vêm das VENDAS (Oportunidades › Vendas) sozinhas; as saídas são lançadas aqui.
 *
 * Só gerente ou acima vê e lança (decisão do Arthur); a RLS das tabelas `fin_*` repete o piso. A tela
 * antiga (faturamento por forma de pagamento + comandas) saiu do fluxo.
 */
export default async function FinancasPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const plataforma = user.is_platform_admin && !user.support;
  if (!plataforma && ROLE_RANK[org.role] < ROLE_RANK.manager) redirect("/app");

  const t = (texto: string) => traduzir(texto, user.idioma);
  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 p-4 sm:px-8 sm:py-6 2xl:px-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Finanças")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Quanto entrou, quanto saiu e quanto sobra — com as vendas entrando sozinhas.")}
        </p>
      </header>
      <FinancasCasca />
    </div>
  );
}
