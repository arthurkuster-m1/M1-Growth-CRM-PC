import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResultadosDasCampanhas } from "@/components/marketing/campanhas/ResultadosDasCampanhas";
import { PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { Megaphone } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resultados das campanhas" };

/** O painel de resultados: todas as campanhas num período, com os números reais. */
export default async function ResultadosPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const t = (texto: string) => traduzir(texto, user.idioma);
  return (
    <PaginaDeMarketing
      tom="blue"
      icone={<Megaphone weight="duotone" aria-hidden />}
      superior={t("Campanhas")}
      titulo={t("Resultados")}
      descricao={t(
        "Investido, leads, vendas e faturamento de cada campanha, no período que você escolher.",
      )}
      voltar={{ href: "/app/marketing/geracao-de-demanda", rotulo: t("Campanhas") }}
    >
      <ResultadosDasCampanhas />
    </PaginaDeMarketing>
  );
}
