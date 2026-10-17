"use client";

import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

interface Previa {
  funis_apagados: number;
  leads: number;
  destinos: Array<{ id: string; name: string }>;
}

/**
 * Apagar campanhas. O funil de uma campanha só existe por causa dela: apagar a campanha apaga o
 * funil. Os leads que estavam nele ficam — e a pessoa escolhe para qual funil eles passam.
 */
export function ApagarCampanhasDialog({
  ids,
  aoFechar,
  aoConfirmar,
}: {
  /** Vazio = fechado. */
  ids: string[];
  aoFechar: () => void;
  aoConfirmar: (destino: string | null) => Promise<void>;
}) {
  const t = useT();
  const aberto = ids.length > 0;
  const [destino, setDestino] = useState("");
  const [apagando, setApagando] = useState(false);

  const previa = useQuery({
    queryKey: ["demand-campaigns-apagar-previa", ids.join(",")],
    enabled: aberto,
    staleTime: 0,
    queryFn: async () =>
      (
        await apiClient.get<{ data: Previa }>(
          `/api/v1/demand-campaigns/apagar-previa?ids=${ids.join(",")}`,
        )
      ).data,
  });
  const dados = previa.data;
  const precisaDeDestino = (dados?.leads ?? 0) > 0;

  useEffect(() => {
    if (!aberto) setDestino("");
  }, [aberto]);

  const plural = ids.length > 1;
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && !apagando && aoFechar()}>
      <DialogContent className="max-w-md gap-4 p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {plural ? t("Apagar campanhas") : t("Apagar campanha")}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "O funil de cada campanha é apagado junto, e o diário e os dados dela também. Isso não pode ser desfeito.",
          )}
        </DialogDescription>

        {previa.isLoading ? (
          <div className="h-12 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
        ) : precisaDeDestino ? (
          <div className="grid gap-2 rounded-xl border bg-secondary/40 p-3">
            <p className="text-sm">
              {dados!.leads === 1
                ? t("1 lead está nesse funil e vai ser mantido.")
                : `${dados!.leads} ${t("leads estão nesse funil e vão ser mantidos.")}`}{" "}
              {t("Para qual funil eles devem passar?")}
            </p>
            <SelectDoApp
              value={destino}
              aria-label={t("Funil de destino dos leads")}
              onChange={(e) => setDestino(e.target.value)}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
            >
              <option value="">{t("Escolha o funil de destino")}</option>
              {(dados?.destinos ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectDoApp>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={apagando}
            onClick={aoFechar}
            className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {t("Cancelar")}
          </button>
          <button
            type="button"
            disabled={apagando || previa.isLoading || (precisaDeDestino && destino === "")}
            onClick={async () => {
              setApagando(true);
              await aoConfirmar(precisaDeDestino ? destino : null);
              setApagando(false);
            }}
            className="h-10 rounded-xl bg-error px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {plural ? t("Apagar campanhas") : t("Apagar campanha")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
