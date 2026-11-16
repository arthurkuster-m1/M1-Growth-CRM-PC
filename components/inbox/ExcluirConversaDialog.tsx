"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Escolha = "so_conversa" | "lead_inteiro";

/**
 * EXCLUIR A CONVERSA, e escolher o que acontece com o lead:
 *  - só a conversa: as mensagens saem e o lead continua cadastrado no CRM (sem apagar mais nada);
 *  - o lead inteiro: a conversa, as oportunidades, vendas, tarefas e o histórico saem junto — uma
 *    cópia fica na Lixeira do CRM por 7 dias.
 * A escolha nunca vem pré-marcada na opção mais destrutiva.
 */
export function ExcluirConversaDialog({
  conversationId,
  nomeDoContato,
  temLead,
  aberto,
  aoFechar,
  aoExcluida,
}: {
  conversationId: string;
  nomeDoContato: string;
  /** A conversa tem um lead (contato) ligado: sem ele só dá para excluir a conversa. */
  temLead: boolean;
  aberto: boolean;
  aoFechar: () => void;
  aoExcluida: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [escolha, setEscolha] = useState<Escolha>("so_conversa");
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      await apiClient.delete(`/api/v1/conversations/${conversationId}`, {
        apagar_lead: temLead && escolha === "lead_inteiro",
      });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation-counts"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(
        escolha === "lead_inteiro" && temLead
          ? t("Lead e conversa excluídos. O lead fica 7 dias na Lixeira do CRM.")
          : t("Conversa excluída. O lead continua cadastrado."),
      );
      aoFechar();
      aoExcluida();
    } catch (e) {
      showApiError(e);
    } finally {
      setExcluindo(false);
    }
  }

  const opcao = (valor: Escolha, titulo: string, descricao: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm",
        escolha === valor ? "border-primary bg-primary/5" : "hover:bg-secondary",
      )}
    >
      <input
        type="radio"
        name="excluir-conversa"
        className="mt-1"
        checked={escolha === valor}
        onChange={() => setEscolha(valor)}
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{titulo}</span>
        <span className="text-xs text-muted-foreground">{descricao}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && !excluindo && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Excluir esta conversa?")}</DialogTitle>
          <DialogDescription>
            {nomeDoContato ? `${t("Conversa com")} ${nomeDoContato}. ` : ""}
            {t("Escolha o que fazer com o lead:")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {opcao(
            "so_conversa",
            t("Excluir só a conversa"),
            t(
              "As mensagens desta conversa são apagadas e não voltam. O lead continua cadastrado no CRM, com as oportunidades e o histórico dele.",
            ),
          )}
          {temLead
            ? opcao(
                "lead_inteiro",
                t("Excluir o lead inteiro"),
                t(
                  "Apaga o lead e tudo dele: conversas e mensagens do Inbox, oportunidades, vendas, tarefas e anotações. Fica 7 dias na Lixeira do CRM para restaurar.",
                ),
              )
            : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={excluindo}>
            {t("Cancelar")}
          </Button>
          <Button variant="destructive" onClick={() => void excluir()} disabled={excluindo}>
            {excluindo
              ? t("Excluindo…")
              : escolha === "lead_inteiro" && temLead
                ? t("Excluir lead e conversa")
                : t("Excluir conversa")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
