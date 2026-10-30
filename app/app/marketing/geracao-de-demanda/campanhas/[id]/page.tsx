import { headers } from "next/headers";
import { HEADER_EMBUTIDO } from "@/lib/agencia/cliente-da-aba";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetalheDaCampanha } from "@/components/marketing/campanhas/DetalheDaCampanha";
import { AtalhoEmDestaque, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { Megaphone, Users } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const nome = UUID.test(id) ? (await nomeDaCampanha(id)).nome : null;
  return { title: nome ?? "Campanha" };
}

/** O nome e o funil da campanha (a RLS e o filtro da empresa garantem que é da empresa de quem olha). */
async function nomeDaCampanha(id: string): Promise<{ nome: string | null; funilId: string | null }> {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) return { nome: null, funilId: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from("demand_campaigns")
    .select("name, pipeline_id")
    .eq("id", id)
    .eq("organization_id", org.orgId)
    .maybeSingle();
  return {
    nome: (data?.name as string | undefined)?.trim() || null,
    funilId: (data?.pipeline_id as string | null | undefined) ?? null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A página de UMA campanha: cadastro, investimento e metas, campanhas da plataforma e diário. */
export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) notFound();
  const t = (texto: string) => traduzir(texto, user.idioma);
  // MODO AGÊNCIA: a janela da campanha mostra só o cadastro/diário (sem banner nem atalhos).
  if ((await headers()).get(HEADER_EMBUTIDO) === "1") return <DetalheDaCampanha id={id} />;
  const { nome, funilId } = await nomeDaCampanha(id);

  return (
    <PaginaDeMarketing
      tom="blue"
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Campanhas")}
      titulo={nome ?? t("Campanha")}
      descricao={t("Cadastro, investimento, metas e o diário de bordo desta ação de vendas.")}
      voltar={{
        href: "/app/marketing/geracao-de-demanda",
        rotulo: t("Campanhas"),
      }}
    >
      <DetalheDaCampanha id={id} />
      <section className="grid gap-3 sm:grid-cols-2">
        <AtalhoEmDestaque
          voltarPara={{
            href: `/app/marketing/geracao-de-demanda/campanhas/${id}`,
            rotulo: nome ?? t("a campanha"),
          }}
          // As oportunidades do funil DESTA campanha; sem funil ainda, todas as oportunidades.
          href={
            funilId
              ? `/app/clientes?visao=oportunidades&funil=${funilId}`
              : "/app/clientes?visao=oportunidades"
          }
          titulo={t("CRM")}
          descricao={t("As oportunidades desta campanha")}
          icone={<Users weight="duotone" aria-hidden />}
          tom="green"
        />
        <AtalhoEmDestaque
          voltarPara={{
            href: `/app/marketing/geracao-de-demanda/campanhas/${id}`,
            rotulo: nome ?? t("a campanha"),
          }}
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
