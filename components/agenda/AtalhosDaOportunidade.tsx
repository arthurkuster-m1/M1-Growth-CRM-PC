"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { chaveDaFicha, OrigemEditavel, type DadosDoLead } from "@/components/leads/FichaDoLead";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CaretDown } from "@/lib/ui/icons";

import { Campo } from "./CamposDoCompromisso";

const CLASSE_DO_CAMPO =
  "min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm outline-hidden hover:border-border focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

/**
 * Atalhos da OPORTUNIDADE dentro do compromisso — o que se combina na reunião: o próximo passo e
 * quando, a previsão de fechamento e (num toggle, para não ocupar espaço) a origem. Tudo grava pelas
 * mesmas rotas da página da oportunidade, então muda lá também.
 */
export function AtalhosDaOportunidade({
  leadId,
  podeEditar,
  proximaAcao,
  proximaAcaoEm,
  previsao,
  aoSalvar,
}: {
  leadId: string;
  podeEditar: boolean;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  previsao: string | null;
  aoSalvar: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [acao, setAcao] = React.useState<string | null>(null);

  const gravarProximaAcao = useMutation({
    mutationFn: async (corpo: { proxima_acao?: string; proxima_acao_em?: string | null }) =>
      apiClient.put(`/api/v1/leads/${leadId}/proxima-acao`, corpo),
    onSuccess: () => {
      toast.success(t("Próxima ação atualizada."));
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      aoSalvar();
    },
    onError: showApiError,
  });
  const gravarPrevisao = useMutation({
    mutationFn: async (dia: string | null) =>
      apiClient.patch(`/api/v1/leads/${leadId}`, { expected_close_date: dia }),
    onSuccess: () => {
      toast.success(t("Previsão de fechamento atualizada."));
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      aoSalvar();
    },
    onError: showApiError,
  });

  const origem = useQuery({
    queryKey: chaveDaFicha(leadId),
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${leadId}/origem`)).data,
  });
  const d = origem.data;
  const campanha = d?.campanhas?.find((c) => c.id === d.campaign_id)?.nome ?? null;
  const resumoDaOrigem = [campanha, d?.source].filter(Boolean).join(" · ");

  const salvarAcao = () => {
    if (acao === null) return;
    const limpo = acao.trim();
    setAcao(null);
    if (limpo !== (proximaAcao ?? "")) gravarProximaAcao.mutate({ proxima_acao: limpo });
  };

  return (
    <div
      className="mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3"
      data-testid="atalhos-da-oportunidade"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <Campo rotulo={t("Próxima ação")}>
          <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap">
            <input
              value={acao ?? proximaAcao ?? ""}
              maxLength={300}
              disabled={!podeEditar}
              aria-label={t("Próxima ação")}
              placeholder={t("O que fica combinado")}
              onChange={(e) => setAcao(e.target.value)}
              onBlur={salvarAcao}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setAcao(null);
                  e.currentTarget.blur();
                }
              }}
              className={`${CLASSE_DO_CAMPO} flex-1 basis-40`}
            />
            <CampoDeData
              valor={proximaAcaoEm ?? ""}
              desabilitado={!podeEditar}
              rotulo={t("Data da próxima ação")}
              placeholder={t("Escolher data")}
              aoMudar={(dia) => gravarProximaAcao.mutate({ proxima_acao_em: dia || null })}
              className="max-w-full min-w-0 shrink-0 sm:w-44"
            />
          </div>
        </Campo>
        <Campo rotulo={t("Previsão de fechamento")}>
          <CampoDeData
            valor={previsao ?? ""}
            desabilitado={!podeEditar}
            rotulo={t("Previsão de fechamento")}
            placeholder={t("Escolher data")}
            aoMudar={(dia) => gravarPrevisao.mutate(dia || null)}
            className="w-full"
          />
        </Campo>
      </div>

      {d && d.campanhas ? (
        <details
          className="group max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card px-3 py-2 text-sm"
          data-testid="origem-da-oportunidade"
        >
          <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-2">
            <span className="shrink-0 font-medium">{t("Origem")}</span>
            <span className="flex min-w-0 items-center gap-2 text-text-muted">
              <span className="truncate">{resumoDaOrigem || t("Sem origem informada")}</span>
              <CaretDown
                size={14}
                className="shrink-0 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
          </summary>
          <div className="mt-3">
            {podeEditar ? (
              <OrigemEditavel leadId={leadId} dados={d} />
            ) : (
              <p className="text-text-muted">{resumoDaOrigem || t("Sem origem informada")}</p>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}
