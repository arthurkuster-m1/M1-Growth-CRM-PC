import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampanhasDeDemanda } from "@/components/marketing/campanhas/CampanhasDeDemanda";
import { AtalhoEmDestaque, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ChartBar, Megaphone, Users } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campanhas" };

/**
 * Campanhas: as CAMPANHAS do cliente. Cada campanha tem o seu funil, criado dentro
 * dela (aba "Funil de conversão" da campanha) — não existe funil solto. Os leads de todos os
 * funis aparecem na página Clientes.
 */
export default async function GeracaoDeDemandaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="blue"
      larga
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Campanhas")}
      descricao={t("As campanhas do cliente, com o funil e os resultados de cada uma.")}
    >
      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AtalhoEmDestaque
          voltarPara={{ href: "/app/marketing/geracao-de-demanda", rotulo: t("Campanhas") }}
          href="/app/marketing/dashboards?painel=trafego"
          titulo={t("Resultados das campanhas")}
          descricao={t("Dashboard de Tráfego Pago: investido, leads, vendas e faturamento por período")}
          icone={<ChartBar weight="duotone" aria-hidden />}
          tom="blue"
        />
        <AtalhoEmDestaque
          voltarPara={{ href: "/app/marketing/geracao-de-demanda", rotulo: t("Campanhas") }}
          href="/app/clientes"
          titulo={t("Clientes (CRM)")}
          descricao={t("Os leads de todos os funis, em tabela ou quadro")}
          icone={<Users weight="duotone" aria-hidden />}
          tom="green"
        />
        <AtalhoEmDestaque
          voltarPara={{ href: "/app/marketing/geracao-de-demanda", rotulo: t("Campanhas") }}
          href="/app/ads/meta"
          titulo={t("Meta Ads")}
          descricao={t("Resultados das campanhas pagas")}
          icone={<Megaphone weight="duotone" aria-hidden />}
          tom="purple"
        />
      </section>

      <CampanhasDeDemanda />
    </PaginaDeMarketing>
  );
}
