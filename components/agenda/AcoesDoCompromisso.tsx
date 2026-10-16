"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ClipboardText, Trash } from "@/lib/ui/icons";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { pedirPagamentoDaOportunidade } from "@/lib/vendas-cliente";
import { cn } from "@/lib/utils";

export type ResultadoDaReuniao = "no_show" | "nao_comprou" | "comprou";

export const OPCOES_DE_RESULTADO: Array<{
  id: ResultadoDaReuniao;
  rotulo: string;
  dica: string;
}> = [
  { id: "no_show", rotulo: "No show", dica: "O cliente não apareceu." },
  { id: "nao_comprou", rotulo: "Compareceu e não comprou", dica: "A reunião aconteceu, sem venda." },
  { id: "comprou", rotulo: "Compareceu e comprou", dica: "Abre a oportunidade para registrar o pagamento." },
];

/** As três ações rápidas do compromisso, as mesmas na lista, na grade e na página do compromisso. */
export function useAcoesDoCompromisso() {
  const t = useT();
  const qc = useQueryClient();
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ["agenda"] });
    void qc.invalidateQueries({ queryKey: ["agenda", "detalhe"] });
  };

  const confirmar = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/api/v1/agenda/agendamentos/${id}/confirmacao`, {}),
    onSuccess: () => {
      toast.success(t("Compromisso confirmado."));
      recarregar();
    },
    onError: showApiError,
  });

  const resultado = useMutation({
    mutationFn: async (a: { id: string; opcao: ResultadoDaReuniao; leadId?: string | null }) => {
      let { leadId } = a;
      if (a.opcao === "comprou" && leadId === undefined) {
        const d = await apiClient.get<{ data: { lead_id: string | null } }>(`/api/v1/agenda/agendamentos/${a.id}`);
        leadId = d.data.lead_id;
      }
      const atual = await apiClient.get<{ data: { revision: number } }>(`/api/v1/agenda/agendamentos/${a.id}`);
      await apiClient.patch("/api/v1/agenda/agendamentos", {
        id: a.id,
        revision: atual.data.revision,
        status: a.opcao === "no_show" ? "no_show" : "completed",
      });
      return { opcao: a.opcao, leadId: leadId ?? null };
    },
    onSuccess: ({ opcao, leadId }) => {
      recarregar();
      if (opcao !== "comprou") {
        toast.success(t("Resultado registrado."));
        return;
      }
      if (leadId) pedirPagamentoDaOportunidade(leadId);
      else toast.message(t("Resultado registrado. Este compromisso não tem oportunidade ligada para lançar a venda."));
    },
    onError: showApiError,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/v1/agenda/agendamentos/${id}`),
    onSuccess: () => {
      toast.success(t("Compromisso excluído."));
      recarregar();
    },
    onError: showApiError,
  });

  return { confirmar, resultado, excluir };
}

/** "Confirmado": a equipe registra que o cliente confirmou presença. */
export function BotaoConfirmado({
  id,
  jaConfirmou,
  tamanho = "sm",
  className,
}: {
  id: string;
  jaConfirmou?: boolean;
  tamanho?: "sm" | "default";
  className?: string;
}) {
  const t = useT();
  const { confirmar } = useAcoesDoCompromisso();
  return (
    <Button
      type="button"
      variant={jaConfirmou ? "secondary" : "outline"}
      size={tamanho}
      disabled={jaConfirmou || confirmar.isPending}
      data-testid={`confirmado-${id}`}
      className={cn("gap-1.5 rounded-xl", className)}
      onClick={() => confirmar.mutate(id)}
    >
      <CheckCircle size={16} weight={jaConfirmou ? "fill" : "bold"} aria-hidden />
      <span>{jaConfirmou ? t("Cliente confirmou") : t("Confirmado")}</span>
    </Button>
  );
}

/** "Resultado": No show, Compareceu e não comprou, Compareceu e comprou. */
export function BotaoResultado({
  id,
  leadId,
  jaComecou = true,
  tamanho = "sm",
  className,
}: {
  id: string;
  leadId?: string | null;
  /** O resultado é sobre o passado: antes de começar, o botão fica desligado. */
  jaComecou?: boolean;
  tamanho?: "sm" | "default";
  className?: string;
}) {
  const t = useT();
  const [aberto, setAberto] = React.useState(false);
  const { resultado } = useAcoesDoCompromisso();
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={tamanho}
          disabled={!jaComecou || resultado.isPending}
          title={jaComecou ? undefined : t("Disponível quando a reunião começar")}
          data-testid={`resultado-${id}`}
          className={cn("gap-1.5 rounded-xl", className)}
        >
          <ClipboardText size={16} weight="bold" aria-hidden />
          <span>{t("Resultado")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl p-2">
        <ul className="flex flex-col gap-1">
          {OPCOES_DE_RESULTADO.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                data-testid={`resultado-${o.id}-${id}`}
                className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent-soft"
                onClick={() => {
                  setAberto(false);
                  resultado.mutate({ id, opcao: o.id, leadId });
                }}
              >
                <span className="block text-sm font-medium">{t(o.rotulo)}</span>
                <span className="block text-xs text-text-muted">{t(o.dica)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** "Excluir": pede confirmação e apaga de vez (e do Google). */
export function BotaoExcluir({
  id,
  aoExcluir,
  tamanho = "sm",
  className,
}: {
  id: string;
  aoExcluir?: () => void;
  tamanho?: "sm" | "default";
  className?: string;
}) {
  const t = useT();
  const [pedindo, setPedindo] = React.useState(false);
  const { excluir } = useAcoesDoCompromisso();
  if (pedindo)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-error/40 bg-error-bg px-2 py-1 text-xs">
        <span>{t("Excluir de vez?")}</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="rounded-lg"
          disabled={excluir.isPending}
          data-testid={`excluir-confirmar-${id}`}
          onClick={() =>
            excluir.mutate(id, {
              onSuccess: () => {
                setPedindo(false);
                aoExcluir?.();
              },
            })
          }
        >
          {t("Sim, excluir")}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setPedindo(false)}>
          {t("Não")}
        </Button>
      </span>
    );
  return (
    <Button
      type="button"
      variant="ghost"
      size={tamanho}
      data-testid={`excluir-${id}`}
      className={cn("gap-1.5 rounded-xl text-error-fg hover:text-error-fg", className)}
      onClick={() => setPedindo(true)}
    >
      <Trash size={16} weight="bold" aria-hidden />
      <span>{t("Excluir")}</span>
    </Button>
  );
}
