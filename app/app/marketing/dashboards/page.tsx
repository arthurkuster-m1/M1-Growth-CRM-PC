import type { Metadata } from "next";

import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ChartLineUp } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboards" };

/** Dashboards: tráfego, vendas e faturamento. */
export default async function DashboardsPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="pink"
      icone={<ChartLineUp weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Dashboards")}
      descricao={t("Tráfego, vendas e faturamento, em números.")}
      estado={t("Em breve")}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Atalho
          href="/app/metrics"
          titulo={t("Métricas")}
          descricao={t("Os números do atendimento e das vendas")}
        />
        <Atalho
          href="/app/faturamento"
          titulo={t("Faturamento")}
          descricao={t("Compras e receita")}
        />
        <Atalho
          href="/app/ads/meta"
          titulo={t("Meta Ads")}
          descricao={t("Resultados das campanhas pagas")}
        />
      </section>

      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t("Tráfego pago: investimento, cliques, leads e custo por lead."),
          t("Vendas: do primeiro contato ao fechamento."),
          t("Faturamento: receita e valor do cliente ao longo do tempo."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
