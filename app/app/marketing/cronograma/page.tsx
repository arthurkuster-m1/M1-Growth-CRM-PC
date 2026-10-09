import type { Metadata } from "next";

import { Atalho, OQueVem, PaginaDeMarketing } from "@/components/marketing/PaginaDeMarketing";
import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { CalendarBlank } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cronograma" };

/** Cronograma: as tarefas da semana, da agência e do cliente. */
export default async function CronogramaPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);

  return (
    <PaginaDeMarketing
      tom="green"
      icone={<CalendarBlank weight="duotone" aria-hidden />}
      superior={t("Marketing")}
      titulo={t("Cronograma")}
      descricao={t("As tarefas da semana: o que é da agência e o que é do cliente.")}
      estado={t("Em breve")}
      voltar={{ href: "/app/marketing", rotulo: t("Marketing") }}
    >
      <section
        aria-label={t("Telas relacionadas")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Atalho
          href="/app/tarefas"
          titulo={t("Tarefas")}
          descricao={t("Tabela, quadro, calendário e linha do tempo")}
        />
      </section>

      <OQueVem
        titulo={t("O que vem aqui")}
        itens={[
          t("A semana do projeto numa linha do tempo clara, com o que cabe a cada lado."),
          t("Tarefas da agência e do cliente separadas, com prazos e responsáveis."),
          t("Usa o mesmo motor de Tarefas do sistema: o que muda lá aparece aqui."),
        ]}
      />
    </PaginaDeMarketing>
  );
}
