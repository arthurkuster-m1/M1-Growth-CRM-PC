import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { TaxasDePagamento } from "./_taxas";

export const dynamic = "force-dynamic";

/**
 * AS TAXAS DE PAGAMENTO — o que a operadora desconta de cada forma de recebimento (Pix, cartão…).
 *
 * É o que sobrou do antigo "Financeiro" das comandas (contas, formas de pagamento, plano de contas,
 * comissão e recorrências), que saiu do fluxo do CRM: o dinheiro agora vem das Vendas (Oportunidades ›
 * Vendas) e é acompanhado em Finanças. As taxas ficam porque o diálogo da venda e os dashboards usam
 * o valor líquido do recebimento.
 *
 * Escrita é de manager+ — a RLS diz isso e esta página só decide o que mostrar.
 */
export default async function Page() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const podeEditar = ROLE_RANK[org.role] >= ROLE_RANK.manager;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Taxas de pagamento</h1>
        <p className="text-sm text-text-muted">
          Quanto a operadora desconta em cada forma de recebimento. A venda mostra o valor líquido.
        </p>
      </div>
      <TaxasDePagamento podeEditar={podeEditar} />
    </div>
  );
}
