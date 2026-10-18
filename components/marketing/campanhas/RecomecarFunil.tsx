"use client";

import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  MODELOS_DE_FUNIL_FIXOS,
  idDoModeloFixo,
  modeloFixoDoId,
} from "@/lib/marketing/modelos-de-funil-fixos";

interface ModeloDaEmpresa {
  id: string;
  name: string;
  stages: unknown[];
}

type SaidaDoAntigo = "excluido" | "arquivado" | "mantido" | null;

/**
 * "APAGAR E RECOMEÇAR": troca o funil da campanha por um novo, de um modelo (os prontos ou os da
 * empresa). Os formulários da campanha passam para o funil novo. O funil antigo é APAGADO se estiver
 * vazio e ARQUIVADO — com todas as oportunidades e o histórico — se tiver negócios: o que tem
 * dinheiro e conversa dentro nunca é destruído de uma vez.
 */
export function RecomecarFunil({
  campanhaId,
  modelos,
  aoFechar,
  aoConcluir,
}: {
  campanhaId: string;
  modelos: ModeloDaEmpresa[];
  aoFechar: () => void;
  aoConcluir: () => Promise<void> | void;
}) {
  const t = useT();
  const [escolhido, setEscolhido] = useState("");
  const [trabalhando, setTrabalhando] = useState(false);

  const resumo = (saida: SaidaDoAntigo, motivo?: string) =>
    saida === "excluido"
      ? t("Funil novo criado. O antigo estava vazio e foi apagado.")
      : saida === "arquivado"
        ? t("Funil novo criado. O antigo foi arquivado, com as oportunidades e o histórico.")
        : `${t("Funil novo criado. O antigo foi mantido")}${motivo ? `: ${motivo}` : "."}`;

  async function confirmar() {
    setTrabalhando(true);
    try {
      const r = await apiClient.post<{
        data: { funil_antigo: SaidaDoAntigo; motivo_do_funil_antigo?: string };
      }>(`/api/v1/demand-campaigns/${campanhaId}/funnel`, {
        template_id: escolhido === "" ? null : escolhido,
        substituir: true,
      });
      toast.success(resumo(r.data.funil_antigo, r.data.motivo_do_funil_antigo));
      await aoConcluir();
      aoFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setTrabalhando(false);
    }
  }

  const fixo = modeloFixoDoId(escolhido);

  return (
    <Dialog open onOpenChange={(a) => !a && !trabalhando && aoFechar()}>
      <DialogContent className="max-w-md gap-4 p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {t("Apagar e recomeçar o funil")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "O funil atual sai desta campanha e um novo nasce do modelo que você escolher. Os formulários da campanha passam a mandar os leads para o novo.",
          )}
        </DialogDescription>
        <SeletorEmPopup
          rotulo={t("Modelo de funil")}
          valor={escolhido}
          placeholder={t("Escolha um modelo")}
          rotuloVazio={t("Funil em branco (Novo, Em andamento, Comprou, Não comprou)")}
          aoEscolher={setEscolhido}
          opcoes={[
            ...MODELOS_DE_FUNIL_FIXOS.map((m) => ({
              id: idDoModeloFixo(m.chave),
              rotulo: `${t("Pronto")} · ${t(m.nome)}`,
            })),
            ...modelos.map((m) => ({ id: m.id, rotulo: m.name })),
          ]}
        />
        {fixo ? (
          <p className="rounded-lg bg-secondary/60 p-2.5 text-xs font-medium">
            {fixo.stages.map((e) => t(e.name)).join(" → ")}
          </p>
        ) : null}
        <p className="rounded-lg border border-warning/40 bg-warning-bg p-2.5 text-xs">
          {t(
            "Funil vazio é apagado. Funil com oportunidades é arquivado: elas e o histórico continuam guardados, só saem do funil desta campanha.",
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={trabalhando}
            onClick={aoFechar}
            className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            disabled={trabalhando}
            onClick={() => void confirmar()}
            className="h-10 rounded-xl bg-error px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {trabalhando ? t("Recomeçando…") : t("Apagar e recomeçar")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
