import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetalheDaCampanha } from "@/components/marketing/campanhas/DetalheDaCampanha";
import { AtalhoEmDestaque, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { Megaphone, Users } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campanha" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A página de UMA campanha: cadastro, investimento e metas, campanhas da plataforma e diário. */
export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) notFound();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="blue"
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Campanhas")}
      titulo={t("Campanha")}
      descricao={t("Cadastro, investimento, metas e o diário de bordo desta ação de vendas.")}
      voltar={{
        href: "/app/marketing/geracao-de-demanda",
        rotulo: t("Campanhas"),
      }}
    >
      <DetalheDaCampanha id={id} />
      <section className="grid gap-3 sm:grid-cols-2">
        <AtalhoEmDestaque
          href="/app/clientes"
          titulo={t("Clientes (CRM)")}
          descricao={t("Os leads de todos os funis")}
          icone={<Users weight="duotone" aria-hidden />}
          tom="green"
        />
        <AtalhoEmDestaque
          href="/app/ads/meta"
          titulo={t("Meta Ads")}
          descricao={t("Resultados das campanhas pagas")}
          icone={<Megaphone weight="duotone" aria-hidden />}
          tom="purple"
        />
      </section>
    </PaginaDeMarketing>
  );
}
