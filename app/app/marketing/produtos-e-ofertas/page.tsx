import type { Metadata } from "next";

import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { Package } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Produtos e ofertas" };

/** Produtos e ofertas: o que se vende e com qual promessa. */
export default async function ProdutosEOfertasPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="purple"
      icone={<Package weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Produtos e ofertas")}
      descricao={t("O que você vende e como isso é apresentado ao mercado.")}
      estado={t("Em breve")}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Atalho
          href="/app/products"
          titulo={t("Produtos")}
          descricao={t("O catálogo de produtos do CRM")}
        />
      </section>

      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t("Cada produto com a sua oferta: promessa, preço, garantias e bônus."),
          t("A apresentação da oferta em página bonita, para você revisar e aprovar."),
          t("Ligação com o catálogo de produtos que já existe no CRM."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
