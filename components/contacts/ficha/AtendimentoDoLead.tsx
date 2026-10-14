"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { BlocoDaFicha, CampoLido, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { TarefasDoLead } from "@/components/contacts/ficha/TarefasDoLead";
import {
  useDadosDosNegocios,
  useEquipeDaFicha,
  useQualificacaoDoContato,
} from "@/components/contacts/ficha/dados-da-ficha";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { format } from "date-fns";
import type { Tarefa } from "@/lib/tarefas/tipos";

const PRIORIDADE: Record<string, { rotulo: string; cor: "gray" | "blue" | "yellow" | "red" }> = {
  low: { rotulo: "Baixa", cor: "gray" },
  medium: { rotulo: "Média", cor: "blue" },
  high: { rotulo: "Alta", cor: "yellow" },
  urgent: { rotulo: "Urgente", cor: "red" },
};
const SITUACAO: Record<string, { rotulo: string; cor: "gray" | "blue" | "green" | "red" }> = {
  pending: { rotulo: "Pendente", cor: "gray" },
  in_progress: { rotulo: "Em andamento", cor: "blue" },
  done: { rotulo: "Concluída", cor: "green" },
  cancelled: { rotulo: "Cancelada", cor: "red" },
};

/** ATENDIMENTO E TAREFAS: quem cuida do lead e o que está pendente com ele. */
export function AtendimentoDoLead({
  contactId,
  nomeDoContato = "",
  abrirTarefaId = null,
}: {
  contactId: string;
  nomeDoContato?: string;
  /** Abre esta tarefa no painel (vindo da Visão geral). */
  abrirTarefaId?: string | null;
}) {
  const t = useT();
  const locale = useLocaleDeData();
  const qual = useQualificacaoDoContato(contactId);
  const negocios = useDadosDosNegocios((qual.data?.funis ?? []).map((f) => f.lead_id));

  const tarefas = useQuery({
    queryKey: ["tarefas-do-contato", contactId],
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { tasks: Tarefa[] } }>(
          `/api/v1/tasks?contact_id=${contactId}&aberto=true`,
        )
      ).data.tasks ?? [],
  });
  const equipe = useEquipeDaFicha();
  const nome = (id: string | null) => {
    if (!id) return "—";
    const p = (equipe.data ?? []).find((x) => x.user_id === id);
    return p?.name ?? p?.email ?? "—";
  };
  const dia = (iso: string | null | undefined, hora = false) =>
    iso ? format(new Date(iso), hora ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy", { locale }) : "—";

  const lista = tarefas.data ?? [];
  const [agora] = useState(() => Date.now());

  return (
    <div className="grid gap-4">
      <BlocoDaFicha titulo={t("Atendimento")} cor="blue">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoLido rotulo={t("Primeira abordagem")} valor={dia(qual.data?.primeira_abordagem, true)} />
          <CampoLido
            rotulo={t("Qualificação")}
            valor={qual.data?.is_mql ? <SeloDaFicha cor="green">MQL</SeloDaFicha> : <SeloDaFicha cor="gray">{t("Não qualificado")}</SeloDaFicha>}
          />
          <CampoLido rotulo={t("Funis")} valor={String(qual.data?.funis.length ?? 0)} />
          <CampoLido rotulo={t("Tarefas pendentes")} valor={String(lista.length)} />
        </dl>
        {negocios.dados.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Funil")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Etapa")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Responsável")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Última atividade")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Na etapa desde")}</th>
                </tr>
              </thead>
              <tbody>
                {negocios.dados.map((n) => (
                  <tr key={n.lead_id} className="border-t">
                    <td className="px-3 py-2">{n.negocio.funil_nome ?? "—"}</td>
                    <td className="px-3 py-2">{n.negocio.etapa_nome ?? "—"}</td>
                    <td className="px-3 py-2">
                      {n.sistema.responsavel ??
                        (n.sistema.responsavel_tipo === "agent" ? t("Agente de IA") : "—")}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{dia(n.sistema.ultima_atividade_em, true)}</td>
                    <td className="px-3 py-2 tabular-nums">{dia(n.sistema.entrou_na_etapa_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </BlocoDaFicha>

      <BlocoDaFicha titulo={t("Tarefas")} cor="orange">
        <TarefasDoLead contactId={contactId} nome={nomeDoContato} abrirInicial={abrirTarefaId} />
      </BlocoDaFicha>
    </div>
  );
}
