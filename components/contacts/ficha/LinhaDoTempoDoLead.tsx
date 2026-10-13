"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { TimelineView } from "@/components/contacts/TimelineView";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import {
  ACOES_DO_LEAD,
  RESULTADOS_DA_LIGACAO,
  type IdDaAcao,
} from "@/lib/leads/acoes-do-lead";
import { cn } from "@/lib/utils";

/**
 * A LINHA DO TEMPO: tudo o que aconteceu com o lead, num fluxo só (atividades, timeline, funis,
 * vendas, tarefas…), e os botões para registrar à mão uma ação (ligação + resultado, mensagem
 * enviada, remarcou…).
 */
export function LinhaDoTempoDoLead({
  contactId,
  podeEditar,
}: {
  contactId: string;
  podeEditar: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [acao, setAcao] = useState<IdDaAcao | null>(null);
  const [resultado, setResultado] = useState("");
  const [comentario, setComentario] = useState("");

  const registrar = useMutation({
    mutationFn: async () =>
      apiClient.post(`/api/v1/contacts/${contactId}/atividades`, {
        acao,
        ...(resultado ? { resultado } : {}),
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success(t("Ação registrada no histórico"));
      setAcao(null);
      setResultado("");
      setComentario("");
      void qc.invalidateQueries({ queryKey: ["contact-timeline"] });
      void qc.invalidateQueries({ queryKey: ["timeline"] });
      void qc.invalidateQueries();
    },
    onError: showApiError,
  });
  const atual = ACOES_DO_LEAD.find((a) => a.id === acao);

  return (
    <div className="grid gap-4">
      {podeEditar ? (
        <BlocoDaFicha titulo={t("Registrar ação")} cor="purple">
          <div className="flex flex-wrap gap-2">
            {ACOES_DO_LEAD.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAcao(a.id === acao ? null : a.id)}
                className={cn(
                  "rounded-full border-[1.5px] px-3 py-1 text-xs font-medium transition-colors",
                  a.id === acao
                    ? "border-purple-500 bg-purple-500/15"
                    : "border-border hover:border-purple-400 hover:bg-secondary",
                )}
              >
                {t(a.rotulo)}
              </button>
            ))}
          </div>
          {atual ? (
            <div className="mt-3 grid gap-2">
              {atual.comResultado ? (
                <div className="grid gap-1">
                  <label className="text-xs font-medium">{t("Resultado")}</label>
                  <Input
                    list="resultados-da-acao"
                    value={resultado}
                    maxLength={200}
                    placeholder={t("Escolha ou escreva o resultado")}
                    onChange={(e) => setResultado(e.target.value)}
                  />
                  <datalist id="resultados-da-acao">
                    {RESULTADOS_DA_LIGACAO.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              ) : null}
              <Textarea
                rows={2}
                value={comentario}
                maxLength={800}
                placeholder={t("Comentário do atendente (opcional)")}
                onChange={(e) => setComentario(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAcao(null)}>
                  {t("Cancelar")}
                </Button>
                <Button size="sm" disabled={registrar.isPending} onClick={() => registrar.mutate()}>
                  {registrar.isPending ? t("Registrando…") : t("Registrar no histórico")}
                </Button>
              </div>
            </div>
          ) : null}
        </BlocoDaFicha>
      ) : null}

      <BlocoDaFicha titulo={t("Histórico")} cor="blue">
        <TimelineView contactId={contactId} />
      </BlocoDaFicha>
    </div>
  );
}
