import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { EstiloDaMarcaDaOrganizacao } from "@/app/app/_components/EstiloDaMarcaDaOrganizacao";
import { DashboardsPublico } from "@/components/dashboards/DashboardsPublico";
import { CabecalhoPublico } from "@/components/marketing/CabecalhoPublico";
import { CHAVE_DOS_DASHBOARDS } from "@/lib/dashboards/chave";
import { traduzir } from "@/lib/i18n/dicionario";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { acessoPermitido, empresaDoLink, resolverLink } from "@/lib/marketing/publico";

export const dynamic = "force-dynamic";

/**
 * Os DASHBOARDS pelo LINK SEM LOGIN: todas as abas e filtros, somente leitura. Só o link criado
 * para os dashboards abre esta página — o link do painel de Marketing, não.
 */
export default async function DashboardsPublicosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await acessoPermitido(ip))) notFound();

  const link = await resolverLink(token);
  if (!link || link.moduloDoEscopo !== CHAVE_DOS_DASHBOARDS) notFound();

  const empresa = await empresaDoLink(link);
  const t = (texto: string) => traduzir(texto, empresa.idioma);

  return (
    <IdiomaProvider locale={empresa.idioma}>
      <div data-marca-org="" className="contents">
        <EstiloDaMarcaDaOrganizacao css={empresa.cssDaMarca} />
        <div className="min-h-dvh bg-background">
          <CabecalhoPublico
            nome={empresa.nome}
            logoUrl={empresa.logoUrl}
            somenteLeitura={t("Somente leitura")}
            inicio={`/p/${token}/dashboards`}
          />
          <DashboardsPublico token={token} empresa={empresa.nome} />
        </div>
      </div>
    </IdiomaProvider>
  );
}
