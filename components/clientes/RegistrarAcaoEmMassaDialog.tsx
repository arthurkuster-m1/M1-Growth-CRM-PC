"use client";

import { RegistrarAcaoDoLead } from "@/components/contacts/ficha/LinhaDoTempoDoLead";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";

/**
 * "Registrar ação" em vários leads de uma vez, no mesmo motor da ficha do lead (ligação +
 * resultado, mensagem enviada, remarcou…): a ação entra na linha do tempo de cada um.
 */
export function RegistrarAcaoEmMassaDialog({
  contatoIds,
  leadId,
  aberto,
  aoFechar,
  aoConcluir,
}: {
  contatoIds: string[];
  /** Uma oportunidade: a ação entra na atividade dela. */
  leadId?: string;
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? null : aoFechar())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Registrar ação")}</DialogTitle>
          <DialogDescription>
            {leadId
              ? t("A ação entra na atividade desta oportunidade e no histórico do lead.")
              : contatoIds.length === 1
                ? t("A ação entra na linha do tempo deste lead.")
                : `${t("A ação entra na linha do tempo dos")} ${contatoIds.length} ${t("leads selecionados.")}`}
          </DialogDescription>
        </DialogHeader>
        <RegistrarAcaoDoLead
          contactIds={contatoIds}
          leadId={leadId}
          podeEditar
          semBloco
          aoRegistrar={() => {
            aoConcluir();
            aoFechar();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
