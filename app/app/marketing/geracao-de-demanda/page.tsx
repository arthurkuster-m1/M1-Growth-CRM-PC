import type { Metadata } from "next";

import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { Megaphone } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Geração de demanda" };

/** Geração de demanda: campanhas, criativos e textos. */
export default async function GeracaoDeDemandaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="blue"
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Geração de demanda")}
      descricao={t("Campanhas, criativos e textos que trazem clientes.")}
      estado={t("Em breve")}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Atalho
          href="/app/ads/meta"
          titulo={t("Meta Ads")}
          descricao={t("Resultados das campanhas pagas")}
        />
      </section>

      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t("Campanhas, criativos e textos, cada um com o estado: ativo ou pausado."),
          t("Os links e os resultados de cada peça, num só painel."),
          t("A estratégia por trás de cada campanha, contada em uma página."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
