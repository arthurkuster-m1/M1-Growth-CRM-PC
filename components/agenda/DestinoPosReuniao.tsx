"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { EVENTO_DESTINO_POS_REUNIAO } from "@/lib/destino-pos-reuniao-cliente";
import type { OpcaoDeDestino, TipoDeDestino } from "@/lib/leads/destino-pos-reuniao";
import { CANONICAL_LOST_REASONS, ROTULO_DO_MOTIVO_CANONICO } from "@/lib/schemas/leads";
import { cn } from "@/lib/utils";

interface Resposta {
  lead: { id: string; status: string; updated_at: string };
  opcoes: OpcaoDeDestino[];
}

/** Motivos que a pessoa escolhe; os dois de SISTEMA (troca de funil, parar de receber) ficam de fora. */
const MOTIVOS_ESCOLHIVEIS = CANONICAL_LOST_REASONS.filter(
  (m) => m !== "moved_to_another_pipeline" && m !== "opted_out_of_messages",
);

const DESCRICAO: Record<TipoDeDestino, string> = {
  negociacao: "A conversa continua: proposta, ajustes, decisão.",
  desqualificado: "Não é o perfil do negócio. Encerra a oportunidade.",
  nao_comprou: "Não vai comprar. Encerra a oportunidade como perdida.",
};

/**
 * "E AGORA?" — depois de "Compareceu e não comprou" a oportunidade fica em Reunião realizada, e
 * este diálogo pergunta para onde ela vai: Em negociação, Desqualificado ou Não comprou (só o que o
 * funil dela oferece). Encerrar pede o motivo. "Deixar como está" fecha sem mexer em nada — o
 * Radar segue de olho na oportunidade.
 */
export function DestinoPosReuniao() {
  const t = useT();
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<TipoDeDestino | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const id = (e as CustomEvent<{ leadId?: string }>).detail?.leadId;
      if (!id) return;
      setLeadId(id);
      setEscolhido(null);
      setMotivo("");
    };
    window.addEventListener(EVENTO_DESTINO_POS_REUNIAO, ouvir);
    return () => window.removeEventListener(EVENTO_DESTINO_POS_REUNIAO, ouvir);
  }, []);

  const consulta = useQuery({
    queryKey: ["destinos-pos-reuniao", leadId],
    enabled: leadId !== null,
    staleTime: 0,
    queryFn: async () =>
      (await apiClient.get<{ data: Resposta }>(`/api/v1/leads/${leadId}/destinos-pos-reuniao`))
        .data,
  });

  // O funil não oferece nenhum destino (ou o negócio já foi encerrado): nada a perguntar.
  const semNadaAOferecer = consulta.data !== undefined && consulta.data.opcoes.length === 0;
  useEffect(() => {
    if (semNadaAOferecer) setLeadId(null);
  }, [semNadaAOferecer]);

  const opcoes = consulta.data?.opcoes ?? [];
  const opcao = opcoes.find((o) => o.tipo === escolhido);
  const encerra = escolhido === "desqualificado" || escolhido === "nao_comprou";
  const podeConfirmar = opcao !== undefined && (!encerra || motivo !== "") && !salvando;

  async function confirmar() {
    if (!opcao || !leadId || !consulta.data) return;
    setSalvando(true);
    try {
      if (opcao.tipo === "negociacao") {
        await apiClient.post(`/api/v1/leads/${leadId}/move`, {
          stage_id: opcao.stage_id,
          // No fim da coluna: maior que as posições já usadas.
          position_in_stage: Date.now(),
          expected_updated_at: consulta.data.lead.updated_at,
        });
      } else {
        await apiClient.post(`/api/v1/leads/${leadId}/lose`, {
          lost_reason: motivo,
          // "Não comprou" é a etapa de perda de sempre; "Desqualificado" é a etapa dele.
          ...(opcao.tipo === "desqualificado" ? { stage_id: opcao.stage_id } : {}),
        });
      }
      await queryClient.invalidateQueries();
      toast.success(t("Oportunidade atualizada."));
      setLeadId(null);
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={leadId !== null && opcoes.length > 0} onOpenChange={(a) => !a && setLeadId(null)}>
      <DialogContent className="max-w-md gap-4 p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">{t("E agora?")}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "A reunião aconteceu e não houve venda. A oportunidade está em Reunião realizada — para onde ela vai?",
          )}
        </DialogDescription>
        <div role="radiogroup" aria-label={t("Destino da oportunidade")} className="grid gap-2">
          {opcoes.map((o) => (
            <button
              key={o.tipo}
              type="button"
              role="radio"
              aria-checked={escolhido === o.tipo}
              onClick={() => setEscolhido(o.tipo)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                escolhido === o.tipo ? "border-primary bg-primary/10" : "hover:bg-secondary",
              )}
            >
              <span className="block text-sm font-medium">{o.nome}</span>
              <span className="block text-xs text-muted-foreground">{t(DESCRICAO[o.tipo])}</span>
            </button>
          ))}
        </div>
        {encerra ? (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">{t("Motivo")}</p>
            <SeletorEmPopup
              rotulo={t("Motivo")}
              valor={motivo}
              placeholder={t("Escolha o motivo")}
              aoEscolher={setMotivo}
              opcoes={MOTIVOS_ESCOLHIVEIS.map((m) => ({
                id: m,
                rotulo: t(ROTULO_DO_MOTIVO_CANONICO[m]),
              }))}
            />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setLeadId(null)}
            className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
          >
            {t("Deixar como está")}
          </button>
          <button
            type="button"
            disabled={!podeConfirmar}
            onClick={() => void confirmar()}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("Confirmar")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
