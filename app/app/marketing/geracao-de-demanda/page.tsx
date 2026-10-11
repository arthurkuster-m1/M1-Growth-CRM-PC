import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CampanhasDeDemanda } from "@/components/marketing/campanhas/CampanhasDeDemanda";
import { GestaoDeFunis, type FunilDaGestao } from "@/components/marketing/funis/GestaoDeFunis";
import { Atalho, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { Megaphone } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Geração de demanda" };

/**
 * Geração de demanda: os FUNIS do cliente (a agência cria aqui, com as etapas de cada um),
 * as campanhas e os resultados. Os leads de todos os funis aparecem na página Clientes.
 */
export default async function GeracaoDeDemandaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);
  const podeGerir =
    (user.is_platform_admin && !user.support) || ROLE_RANK[org.role] >= ROLE_RANK.manager;

  const supabase = await createClient();
  const [{ data: funis }, { data: etapas }, { data: negocios }] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name, is_default, settings")
      .eq("organization_id", org.orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("crm_stages")
      .select("id, pipeline_id")
      .eq("organization_id", org.orgId)
      .eq("is_archived", false),
    supabase.from("crm_leads").select("pipeline_id").eq("organization_id", org.orgId).limit(5000),
  ]);
  const contaEtapas = new Map<string, number>();
  for (const e of (etapas ?? []) as Array<{ pipeline_id: string }>) {
    contaEtapas.set(e.pipeline_id, (contaEtapas.get(e.pipeline_id) ?? 0) + 1);
  }
  const contaLeads = new Map<string, number>();
  for (const n of (negocios ?? []) as Array<{ pipeline_id: string }>) {
    contaLeads.set(n.pipeline_id, (contaLeads.get(n.pipeline_id) ?? 0) + 1);
  }
  const lista: FunilDaGestao[] = (
    (funis ?? []) as Array<{
      id: string;
      name: string;
      is_default: boolean;
      settings: Record<string, unknown> | null;
    }>
  ).map((f) => {
    const alvo = f.settings?.ao_ganhar_funil_id;
    return {
      id: f.id,
      name: f.name,
      is_default: f.is_default,
      ao_ganhar_funil_id: typeof alvo === "string" ? alvo : null,
      etapas: contaEtapas.get(f.id) ?? 0,
      leads: contaLeads.get(f.id) ?? 0,
    };
  });

  return (
    <PaginaDeMarketing
      tom="blue"
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Geração de demanda")}
      descricao={t("Os funis do cliente, as campanhas e os resultados de cada origem.")}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <GestaoDeFunis funis={lista} podeGerir={podeGerir} />

      <CampanhasDeDemanda />

      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Atalho
          href="/app/clientes"
          titulo={t("Clientes (CRM)")}
          descricao={t("Os leads de todos os funis, em tabela ou quadro")}
        />
        <Atalho
          href="/app/ads/meta"
          titulo={t("Meta Ads")}
          descricao={t("Resultados das campanhas pagas")}
        />
      </section>
    </PaginaDeMarketing>
  );
}
