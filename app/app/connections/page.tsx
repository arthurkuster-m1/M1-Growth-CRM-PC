import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ConexoesShell } from "@/components/connections/ConexoesShell";
import {
  canalGraphParceiroLigado,
  GRAPH_PARTNER_LABEL,
} from "@/lib/channels/graph-parceiro/credentials";
import { traduzir } from "@/lib/i18n/dicionario";
import { lerEstadoDaConexao } from "@/lib/conversoes/estado-da-conexao";
import { lerEtapasAbertas } from "@/lib/conversoes/etapas-abertas";
import { listarRegrasMeta } from "@/lib/conversoes/regras-meta";
import { identidadeDaMeta } from "@/lib/plataformas-de-anuncio/meta/identidade";
import { existeConexaoDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conexões" };

export default async function ConnectionsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }
  const idioma = user.idioma;

  const key = process.env.WAHA_API_KEY;
  const wahaConfigured = Boolean(
    process.env.WAHA_API_BASE_URL && key && key !== "dev_plaintext_change_me",
  );

  // A conexão de leitura do Meta Ads (aba ao lado de Webhooks). Admin client para LER, como a tela
  // antiga: a tabela não tem policy para o browser, e o token nunca é lido nem decifrado aqui.
  const admin = createAdminClient();
  const metaAds = await existeConexaoDeLeitura(admin, activeOrg.orgId, "meta_ads");

  // Meta CAPI (aba Meta Ads): a conexão de ESCRITA de conversões, as regras por etapa e a identidade
  // (Página/WABA). Falha em ler etapas/regras não derruba a tela: o editor some e o resto fica.
  const [estadoCapi, etapasCapi, regrasCapi, organizacao] = await Promise.all([
    lerEstadoDaConexao(admin, activeOrg.orgId),
    lerEtapasAbertas(admin, activeOrg.orgId).catch(() => null),
    listarRegrasMeta(admin, activeOrg.orgId).catch(() => null),
    admin.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle(),
  ]);
  const identidade = identidadeDaMeta(
    (organizacao.data as { settings?: unknown } | null)?.settings,
  );

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Conexões", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir(
            "Por onde seu negócio fala com o cliente. Conecte números por QR ou o número oficial da Meta, e acompanhe a saúde de cada um.",
            idioma,
          )}
        </p>
      </header>
      <ConexoesShell
        wahaConfigured={wahaConfigured}
        metaAds={{ conectada: metaAds.conectada, contaPadrao: metaAds.contaPadrao }}
        capi={{
          estado: estadoCapi,
          etapas: etapasCapi,
          regras: regrasCapi,
          pageId: identidade.pageId,
          whatsappBusinessAccountId: identidade.whatsappBusinessAccountId,
        }}
        idioma={idioma}
        graphParceiro={canalGraphParceiroLigado() ? { label: GRAPH_PARTNER_LABEL } : null}
      />
    </div>
  );
}
