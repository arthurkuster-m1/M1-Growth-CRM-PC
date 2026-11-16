"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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

/**
 * EXCLUIR O LEAD INTEIRO, pela ficha: o contato e tudo que depende dele — conversas e mensagens do
 * Inbox, oportunidades, vendas, tarefas, anotações e atividades. Uma cópia fica 7 dias na Lixeira
 * do CRM (dá para restaurar de lá).
 */
export function ExcluirLeadDialog({
  contactId,
  nome,
  aberto,
  aoFechar,
}: {
  contactId: string;
  nome: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      const r = await apiClient.post<{
        data: { excluidos: number; falhas: Array<{ contact_id: string; motivo: string }> };
      }>("/api/v1/clientes/lote", { action: "excluir", contact_ids: [contactId] });
      if (r.data.excluidos === 0) {
        toast.error(r.data.falhas[0]?.motivo ?? t("Não foi possível excluir o lead."));
        return;
      }
      await queryClient.invalidateQueries();
      toast.success(t("Lead excluído. Fica 7 dias na Lixeira do CRM."));
      aoFechar();
      router.push("/app/clientes");
    } catch (e) {
      showApiError(e);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && !excluindo && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("Excluir")} {nome || t("este lead")}?
          </DialogTitle>
          <DialogDescription>
            {t(
              "O lead inteiro será excluído: conversas e mensagens do Inbox, oportunidades, vendas, tarefas e anotações. Uma cópia fica 7 dias na Lixeira do CRM, de onde dá para restaurar.",
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={aoFechar} disabled={excluindo}>
            {t("Cancelar")}
          </Button>
          <Button variant="destructive" onClick={() => void excluir()} disabled={excluindo}>
            {excluindo ? t("Excluindo…") : t("Excluir lead")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
