import type { Metadata } from "next";

import { CronogramaDoCliente } from "@/components/marketing/cronograma/CronogramaDoCliente";
import { PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { CalendarBlank } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cronograma" };

/** Cronograma: as metas, o caminho até elas e as tarefas da semana (agência e cliente). */
export default async function CronogramaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="green"
      icone={<CalendarBlank weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Cronograma")}
      descricao={t(
        "As metas, o caminho até elas e as tarefas da semana: o que é da agência e o que é do cliente.",
      )}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <CronogramaDoCliente />
    </PaginaDeMarketing>
  );
}
