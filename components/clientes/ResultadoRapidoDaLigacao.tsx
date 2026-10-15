"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { RESULTADOS_RAPIDOS, somarDiasUteis } from "@/lib/leads/resultados-rapidos";
import { cn } from "@/lib/utils";

const hojeIso = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * O RESULTADO RÁPIDO da ligação: um clique registra a ação na linha do tempo da oportunidade e já
 * deixa o próximo passo marcado (ex.: "Não atendeu" → tentar de novo em 1 dia útil).
 */
export function ResultadoRapidoDaLigacao({
  leadId,
  contactId,
  aberta,
  podeEditar,
  aoPerder,
  aoFeito,
}: {
  leadId: string;
  contactId: string;
  aberta: boolean;
  podeEditar: boolean;
  /** "Sem interesse": abre o motivo da perda. */
  aoPerder: () => void;
  aoFeito?: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [dataDoRetorno, setDataDoRetorno] = useState(somarDiasUteis(hojeIso(), 1));
  const [retornoAberto, setRetornoAberto] = useState(false);

  async function aplicar(id: string, resultado: string, proximo?: { texto: string; em: string }) {
    setOcupado(id);
    try {
      await apiClient.post(`/api/v1/contacts/${contactId}/atividades`, {
        acao: "ligacao",
        resultado,
        lead_id: leadId,
      });
      if (proximo) {
        await apiClient.put(`/api/v1/leads/${leadId}/proxima-acao`, {
          proxima_acao: proximo.texto,
          proxima_acao_em: proximo.em,
        });
      }
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      aoFeito?.();
    } catch (e) {
      showApiError(e);
    } finally {
      setOcupado(null);
    }
  }

  if (!aberta) {
    return <span className="block px-2 text-sm text-muted-foreground">—</span>;
  }

  const botao =
    "h-7 shrink-0 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1 px-1.5 py-1" role="group" aria-label={t("Resultado da ligação")}>
      {RESULTADOS_RAPIDOS.map((r) => {
        if ("pedeData" in r && r.pedeData) {
          return (
            <Popover key={r.id} open={retornoAberto} onOpenChange={setRetornoAberto}>
              <PopoverTrigger asChild>
                <button type="button" disabled={!podeEditar || ocupado !== null} className={botao}>
                  {t(r.rotulo)}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-2 p-3">
                <p className="text-xs text-muted-foreground">{t("Retornar a ligação em")}</p>
                <CampoDeData
                  valor={dataDoRetorno}
                  aoMudar={setDataDoRetorno}
                  rotulo={t("Data do retorno")}
                  limpavel={false}
                  className="w-full"
                />
                <button
                  type="button"
                  disabled={ocupado !== null || !dataDoRetorno}
                  onClick={() => {
                    setRetornoAberto(false);
                    void aplicar(r.id, r.resultado, { texto: t(r.proximo), em: dataDoRetorno });
                  }}
                  className="h-8 w-full rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t("Registrar")}
                </button>
              </PopoverContent>
            </Popover>
          );
        }
        return (
          <button
            key={r.id}
            type="button"
            disabled={!podeEditar || ocupado !== null}
            title={"proximo" in r ? t(r.proximo) : undefined}
            className={cn(botao, "perde" in r && r.perde && "text-error-fg")}
            onClick={() => {
              if ("perde" in r && r.perde) {
                void aplicar(r.id, r.resultado).then(aoPerder);
                return;
              }
              if (!("proximo" in r)) return;
              const dias = "diasUteis" in r ? r.diasUteis : 0;
              void aplicar(r.id, r.resultado, {
                texto: t(r.proximo),
                em: somarDiasUteis(hojeIso(), dias),
              });
            }}
          >
            {t(r.rotulo)}
          </button>
        );
      })}
    </div>
  );
}
