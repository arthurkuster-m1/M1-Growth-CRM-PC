"use client";

import { useState } from "react";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";

/**
 * A REGRA da próxima ação: toda vez que o texto muda, confirma-se a DATA. A data antiga já vem
 * escolhida; se mudou o plano, escolhe outra; se não, é só dar OK.
 */
export function ConfirmarDataDaProximaAcao({
  texto,
  dataAtual,
  aoConfirmar,
  aoCancelar,
}: {
  texto: string;
  dataAtual: string | null;
  aoConfirmar: (data: string | null) => void;
  aoCancelar: () => void;
}) {
  const t = useT();
  const [data, setData] = useState(dataAtual ?? "");
  return (
    <Dialog open onOpenChange={(a) => !a && aoCancelar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Para quando é esta ação?")}</DialogTitle>
          <DialogDescription className="break-words">
            {texto.trim() === "" ? t("Sem próxima ação.") : `“${texto.trim()}”`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">{t("Data da próxima ação")}</span>
          <CampoDeData valor={data} aoMudar={setData} rotulo={t("Data da próxima ação")} className="w-full" />
          {dataAtual ? (
            <span className="text-xs text-muted-foreground">
              {t("Data atual:")} {dataAtual.split("-").reverse().join("/")} — {t("mude se o plano mudou, ou dê OK.")}
            </span>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoCancelar}
            className="h-9 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            onClick={() => aoConfirmar(data || null)}
            className="h-9 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            {t("OK")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
