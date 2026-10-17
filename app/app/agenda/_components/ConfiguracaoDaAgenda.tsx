"use client";

import * as React from "react";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/hooks/i18n/useT";
import { Gear } from "@/lib/ui/icons";

import { AttendantsClient } from "@/app/app/team/_components/AttendantsClient";

import { MatrizDeAtendentes } from "./MatrizDeAtendentes";

/**
 * Tudo que configura a Agenda, no fim da própria Agenda, num bloco que abre ao clicar. Três páginas:
 * as regras (Google, presença, colegas, dias fora da rotina, cada uma num bloco que abre), os tipos
 * de atendimento (com a página de atendimento de cada um) e os atendentes com os horários.
 */
export function ConfiguracaoDaAgenda({
  regras,
  tipos,
  podeGerenciarEquipe,
  podeConvidar,
  fuso,
}: {
  /** As regras da Agenda (conteúdo de servidor). */
  regras?: React.ReactNode;
  /** Os tipos de atendimento e a página de cada um (conteúdo de servidor). */
  tipos: React.ReactNode;
  podeGerenciarEquipe: boolean;
  podeConvidar: boolean;
  fuso: string;
}) {
  const t = useT();
  return (
    <div id="configuracao-da-agenda" data-testid="configuracao-da-agenda">
      <BlocoRecolhivel
        grande
        titulo={t("Configuração da Agenda")}
        resumo={t("Regras, tipos de atendimento, equipe, horários e agendas conectadas.")}
        icone={
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Gear size={22} weight="bold" aria-hidden />
          </span>
        }
      >
        <Tabs defaultValue="regras">
          <TabsList className="flex h-auto flex-wrap rounded-2xl">
            <TabsTrigger value="regras" className="rounded-xl">{t("Regras da agenda")}</TabsTrigger>
            <TabsTrigger value="tipos" className="rounded-xl">{t("Tipos de atendimento")}</TabsTrigger>
            <TabsTrigger value="equipe" className="rounded-xl">{t("Atendentes e horários")}</TabsTrigger>
          </TabsList>
          <TabsContent value="regras" className="mt-5">
            {regras}
          </TabsContent>
          <TabsContent value="tipos" className="mt-5">
            {tipos}
          </TabsContent>
          <TabsContent value="equipe" className="mt-5">
            <MatrizDeAtendentes podeEditar={podeGerenciarEquipe} podeConvidar={podeConvidar} />
            {podeGerenciarEquipe ? (
              <AttendantsClient canManage organizationTimezone={fuso} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Só gerentes e administradores editam os atendentes e os horários da equipe.")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </BlocoRecolhivel>
    </div>
  );
}
