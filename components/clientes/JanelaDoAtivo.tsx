"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";

const CHAVE = ["clientes", "janela-do-ativo"] as const;

/**
 * "Cliente ativo = pagou nos últimos N meses": o padrão da empresa para o produto que não define
 * a própria janela. Quem é gerente edita; os demais só leem.
 */
export function JanelaDoAtivo({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { meses: number } }>("/api/v1/clientes/janela");
      return r.data.meses;
    },
  });
  const [valor, setValor] = useState("");
  useEffect(() => {
    if (data !== undefined) setValor(String(data));
  }, [data]);

  const salvar = async () => {
    const meses = Math.round(Number(valor));
    if (!Number.isFinite(meses) || meses < 1 || meses > 60 || meses === data) {
      setValor(String(data ?? 6));
      return;
    }
    try {
      await apiClient.patch("/api/v1/clientes/janela", { meses });
      qc.setQueryData(CHAVE, meses);
      void qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
      setValor(String(data ?? 6));
    }
  };

  if (data === undefined) return null;
  return (
    <label
      className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
      title={t("Quem pagou dentro deste prazo é cliente ativo. Cada produto pode ter o seu.")}
    >
      {t("Cliente ativo: pagou nos últimos")}
      <input
        type="number"
        min={1}
        max={60}
        value={valor}
        disabled={!podeEditar}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void salvar()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-7 w-14 rounded-md border border-border bg-card px-1.5 text-center text-xs text-foreground"
      />
      {t("meses")}
    </label>
  );
}
