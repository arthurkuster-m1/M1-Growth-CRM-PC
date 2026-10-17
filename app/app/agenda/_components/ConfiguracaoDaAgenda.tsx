"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { Gear } from "@/lib/ui/icons";

import { AttendantsClient } from "@/app/app/team/_components/AttendantsClient";

import { MatrizDeAtendentes } from "./MatrizDeAtendentes";

/**
 * Tudo que configura a Agenda, no fim da própria Agenda: tipos de atendimento (duração, local,
 * lembretes, responsável), prazos, dias bloqueados, agendas do Google, e a equipe que atende com a
 * jornada de cada um.
 */
export function ConfiguracaoDaAgenda({
  tipos,
  podeGerenciarEquipe,
  fuso,
}: {
  /** O conteúdo de servidor com os tipos e as regras da Agenda. */
  tipos: React.ReactNode;
  podeGerenciarEquipe: boolean;
  fuso: string;
}) {
  const t = useT();
  return (
    <section
      id="configuracao-da-agenda"
      data-testid="configuracao-da-agenda"
      className="rounded-3xl border border-border bg-surface p-5 sm:p-6"
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Gear size={22} weight="bold" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{t("Configuração da Agenda")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("Tipos de atendimento, equipe, horários e agendas conectadas, tudo num lugar só.")}
          </p>
        </div>
      </header>
      <Tabs defaultValue="tipos">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="tipos" className="rounded-xl">{t("Atendimentos e regras")}</TabsTrigger>
          <TabsTrigger value="equipe" className="rounded-xl">{t("Atendentes e horários")}</TabsTrigger>
        </TabsList>
        <TabsContent value="tipos" className="mt-5">
          {tipos}
        </TabsContent>
        <TabsContent value="equipe" className="mt-5">
          <MatrizDeAtendentes podeEditar={podeGerenciarEquipe} />
          {podeGerenciarEquipe ? (
            <AttendantsClient canManage organizationTimezone={fuso} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("Só gerentes e administradores editam os atendentes e os horários da equipe.")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
